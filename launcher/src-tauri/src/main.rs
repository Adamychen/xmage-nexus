#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use nexus_launcher::{current_target, extract, fetch, layout, manifest::ComponentsManifest};
use serde::Serialize;
use std::collections::HashMap;
use std::fs::OpenOptions;
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_updater::UpdaterExt;

const DEFAULT_MANIFEST_URL: &str =
    "https://github.com/Adamychen/xmage-nexus/releases/latest/download/components-manifest.json";

#[derive(Clone, Serialize)]
struct StateEvent {
    state: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    component: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}

#[derive(Clone, Serialize)]
struct ProgressEvent {
    component: String,
    done: u64,
    total: Option<u64>,
}

#[derive(Debug, serde::Deserialize)]
struct ContractServer {
    #[serde(rename = "mainClass")]
    main_class: String,
    #[serde(rename = "systemProperties", default)]
    system_properties: HashMap<String, String>,
    #[serde(rename = "addOpens", default)]
    add_opens: Vec<String>,
    classpath: Vec<String>,
    #[serde(default)]
    port: u16,
}

#[derive(Debug, serde::Deserialize)]
struct ContractProxy {
    #[serde(rename = "mainClass")]
    main_class: String,
    jar: String,
    #[serde(rename = "addOpens", default)]
    add_opens: Vec<String>,
    #[serde(rename = "wsPort", default = "default_ws")]
    ws_port: u16,
    #[serde(rename = "httpPort", default = "default_http")]
    http_port: u16,
}

#[derive(Debug, serde::Deserialize)]
struct Contract {
    server: ContractServer,
    proxy: ContractProxy,
}

fn default_ws() -> u16 {
    8787
}

fn default_http() -> u16 {
    8788
}

struct Processes {
    server: Mutex<Option<Child>>,
    proxy: Mutex<Option<Child>>,
}

struct Bootstrap {
    running: Mutex<bool>,
    skip_update: Mutex<bool>,
    last_state: Mutex<StateEvent>,
}

impl Bootstrap {
    fn initial() -> Self {
        Bootstrap {
            running: Mutex::new(false),
            skip_update: Mutex::new(false),
            last_state: Mutex::new(StateEvent {
                state: "checking-update".to_string(),
                component: None,
                message: None,
            }),
        }
    }
}

fn bootstrap_clock() -> std::time::Instant {
    static START: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();
    *START.get_or_init(std::time::Instant::now)
}

fn emit_state(app: &AppHandle, state: &str, component: Option<&str>, message: Option<String>) {
    let event = StateEvent {
        state: state.to_string(),
        component: component.map(|s| s.to_string()),
        message,
    };
    eprintln!(
        "[bootstrap] +{:?} state={} component={}",
        bootstrap_clock().elapsed(),
        event.state,
        event.component.as_deref().unwrap_or("-"),
    );
    if let Some(bootstrap) = app.try_state::<Bootstrap>() {
        *bootstrap
            .last_state
            .lock()
            .unwrap_or_else(|e| e.into_inner()) = event.clone();
    }
    append_bootstrap_log(app, &event);
    if let Err(e) = app.emit("bootstrap://state", event) {
        eprintln!("[bootstrap] emit failed: {e}");
    }
}

fn append_bootstrap_log(app: &AppHandle, event: &StateEvent) {
    let dir = data_root(app).join("logs");
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }
    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join("bootstrap.log"))
    {
        let _ = writeln!(
            f,
            "[+{:?}] state={} component={} message={}",
            bootstrap_clock().elapsed(),
            event.state,
            event.component.as_deref().unwrap_or("-"),
            event.message.as_deref().unwrap_or("-"),
        );
    }
}

fn data_root(app: &AppHandle) -> PathBuf {
    if let Ok(dir) = std::env::var("NEXUS_DATA_DIR") {
        return PathBuf::from(dir);
    }
    app.path()
        .app_local_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("xmage-nexus"))
}

fn manifest_spec() -> String {
    std::env::var("NEXUS_MANIFEST").unwrap_or_else(|_| DEFAULT_MANIFEST_URL.to_string())
}

fn target_tag() -> String {
    std::env::var("NEXUS_TARGET").unwrap_or_else(|_| current_target())
}

fn installed_release(paths: &layout::Paths) -> Option<String> {
    let entries = std::fs::read_dir(&paths.components).ok()?;
    let mut releases: Vec<String> = entries
        .flatten()
        .filter(|e| e.path().join(layout::INSTALLED_MARKER).is_file())
        .filter_map(|e| e.file_name().into_string().ok())
        .collect();
    releases.sort();
    releases.pop()
}

fn wait_log(path: &Path, marker: &str, secs: u64) -> bool {
    let deadline = Instant::now() + Duration::from_secs(secs);
    while Instant::now() < deadline {
        if let Ok(text) = std::fs::read_to_string(path) {
            if text.contains(marker) {
                return true;
            }
        }
        std::thread::sleep(Duration::from_secs(2));
    }
    false
}

fn wait_port(port: u16, secs: u64) -> bool {
    let addr: SocketAddr = format!("127.0.0.1:{port}").parse().unwrap();
    let deadline = Instant::now() + Duration::from_secs(secs);
    while Instant::now() < deadline {
        if TcpStream::connect_timeout(&addr, Duration::from_secs(1)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_secs(2));
    }
    false
}

fn kill_all(processes: &State<Processes>) {
    for slot in [&processes.server, &processes.proxy] {
        if let Ok(mut guard) = slot.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

fn patch_seeded_port(config: &Path, port: u16) -> Result<(), String> {
    if !config.is_file() {
        return Ok(());
    }
    let text = std::fs::read_to_string(config).map_err(|e| format!("config: {e}"))?;
    let Some(start) = text.find("port=\"") else {
        return Ok(());
    };
    let digits = start + 6;
    let end = text[digits..]
        .find('"')
        .map(|i| digits + i)
        .unwrap_or(text.len());
    let mut patched = text;
    patched.replace_range(digits..end, &port.to_string());
    std::fs::write(config, patched).map_err(|e| format!("config: {e}"))?;
    Ok(())
}

fn append_log(path: &Path) -> Stdio {    OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map(Stdio::from)
        .unwrap_or_else(|_| Stdio::null())
}

fn java_bin(jre_dir: &Path) -> PathBuf {
    if cfg!(windows) {
        jre_dir.join("bin").join("java.exe")
    } else {
        jre_dir.join("bin").join("java")
    }
}

fn run_bootstrap(app: AppHandle) {
    let running = app.state::<Bootstrap>();
    {
        let mut guard = running.running.lock().unwrap_or_else(|e| e.into_inner());
        if *guard {
            return;
        }
        *guard = true;
    }
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| bootstrap_or_update(&app)))
        .map_err(|_| "internal error (see logs)".to_string())
        .and_then(|r| r);
    *running.running.lock().unwrap_or_else(|e| e.into_inner()) = false;
    if let Err(message) = result {
        eprintln!("bootstrap failed: {message}");
        emit_state(&app, "error", None, Some(error_code(&message)));
    }
}

/// Maps known user-facing bootstrap failures to stable codes the splash
/// screen translates to the active language. Unknown (technical) errors
/// pass through verbatim as a safe fallback.
fn error_code(message: &str) -> String {
    if message.starts_with("esta versión solo es compatible") {
        return "ERR_MAC_INTEL".to_string();
    }
    if message.starts_with("actualización: ") {
        return format!("ERR_UPDATE_FAILED|{}", message["actualización: ".len()..].trim());
    }
    match message {
        "plataforma no soportada por el instalador" => "ERR_PLATFORM".to_string(),
        "no connection and no downloaded components yet" => "ERR_OFFLINE".to_string(),
        "downloaded runtime is incomplete" => "ERR_INCOMPLETE".to_string(),
        "ya no hay actualización disponible" => "ERR_NO_UPDATE".to_string(),
        _ => message.to_string(),
    }
}

fn bootstrap_or_update(app: &AppHandle) -> Result<(), String> {
    let skip = *app.state::<Bootstrap>().skip_update.lock().unwrap();
    if !skip {
        if let Some(info) = check_for_update(app)? {
            emit_state(app, "update-available", Some("app"), Some(info));
            return Ok(());
        }
    }
    bootstrap(app)
}

const UPDATE_CHECK_INTERVAL_SECS: u64 = 24 * 3600;

fn update_check_due_secs(last: u64, now: u64) -> bool {
    now.saturating_sub(last) >= UPDATE_CHECK_INTERVAL_SECS
}

fn update_check_due(app: &AppHandle) -> bool {
    let last: u64 = std::fs::read_to_string(data_root(app).join("updater-last-check"))
        .ok()
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(0);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    update_check_due_secs(last, now)
}

fn mark_update_checked(app: &AppHandle) {
    if let Ok(now) = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        let _ = std::fs::write(
            data_root(app).join("updater-last-check"),
            now.as_secs().to_string(),
        );
    }
}

fn check_for_update(app: &AppHandle) -> Result<Option<String>, String> {
    if !update_check_due(app) {
        eprintln!("update check skipped (recently checked)");
        return Ok(None);
    }
    emit_state(app, "checking-update", None, None);
    let result = tauri::async_runtime::block_on(async {
        tokio::time::timeout(Duration::from_secs(12), async {
            app.updater_builder()
                .timeout(Duration::from_secs(8))
                .build()
                .map_err(|e| e.to_string())?
                .check()
                .await
                .map_err(|e| e.to_string())
        })
        .await
        .map_err(|_| "update check exceeded hard timeout".to_string())?
    });
    match result {
        Ok(Some(update)) => {
            mark_update_checked(app);
            Ok(Some(format!(
                "{}|{}",
                update.version,
                update.body.clone().unwrap_or_default()
            )))
        }
        Ok(None) => {
            mark_update_checked(app);
            Ok(None)
        }
        Err(e) => {
            eprintln!("update check failed, continuing offline-capable bootstrap: {e}");
            Ok(None)
        }
    }
}

fn bootstrap(app: &AppHandle) -> Result<(), String> {
    let processes = app.state::<Processes>();
    kill_all(&processes);
    emit_state(app, "checking", None, None);

    let paths = layout::resolve(&data_root(app));
    std::fs::create_dir_all(&paths.components).map_err(|e| format!("data dir: {e}"))?;
    std::fs::create_dir_all(&paths.logs).map_err(|e| format!("logs dir: {e}"))?;
    let target = target_tag();
    if target == "mac-x64" {
        return Err(
            "esta versión solo es compatible con Apple Silicon (arm64): no hay componentes para Mac Intel"
                .to_string(),
        );
    }
    if target == "unknown" {
        return Err("plataforma no soportada por el instalador".to_string());
    }

    let remote = fetch::download_text(&manifest_spec(), Duration::from_secs(20))
        .ok()
        .and_then(|text| ComponentsManifest::parse(&text).ok());
    let release = match (&remote, installed_release(&paths)) {
        (Some(m), _) if layout::missing_components(m, &target, &paths).is_empty() => m.release.clone(),
        (Some(m), _) => {
            fetch_release(app, m, &target, &paths)?;
            m.release.clone()
        }
        (None, Some(installed)) => installed,
        (None, None) => {
            return Err("no connection and no downloaded components yet".to_string())
        }
    };

    let server_comp = layout::component_dir(&paths, &release, "server");
    let contract_text = std::fs::read_to_string(server_comp.join("version.json"))
        .map_err(|e| format!("version.json: {e}"))?;
    let mut contract: Contract =
        serde_json::from_str(&contract_text).map_err(|e| format!("contract: {e}"))?;
    if let Ok(port) = std::env::var("NEXUS_SERVER_PORT") {
        if let Ok(port) = port.parse() {
            contract.server.port = port;
        }
    }
    if let Ok(port) = std::env::var("NEXUS_WS_PORT") {
        if let Ok(port) = port.parse() {
            contract.proxy.ws_port = port;
        }
    }
    if let Ok(port) = std::env::var("NEXUS_HTTP_PORT") {
        if let Ok(port) = port.parse() {
            contract.proxy.http_port = port;
        }
    }
    let java = java_bin(&layout::component_dir(&paths, &release, "jre"));
    if !java.is_file() {
        return Err("downloaded runtime is incomplete".to_string());
    }
    layout::seed_server_data(&server_comp, &layout::server_data_dir(&paths))
        .map_err(|e| format!("seed: {e}"))?;
    patch_seeded_port(
        &layout::server_data_dir(&paths).join("config").join("config.xml"),
        contract.server.port,
    )?;

    emit_state(app, "starting-server", None, None);
    let sep = if cfg!(windows) { ";" } else { ":" };
    let classpath: Vec<String> = contract
        .server
        .classpath
        .iter()
        .map(|e| {
            let p = Path::new(e);
            if p.is_absolute() {
                e.clone()
            } else {
                server_comp.join(p).display().to_string()
            }
        })
        .collect();
    let mut server_cmd = Command::new(&java);
    for (k, v) in &contract.server.system_properties {
        server_cmd.arg(format!("-D{k}={v}"));
    }
    for flag in &contract.server.add_opens {
        server_cmd.arg(flag);
    }
    server_cmd
        .arg("-cp")
        .arg(classpath.join(sep))
        .arg(&contract.server.main_class)
        .current_dir(layout::server_data_dir(&paths))
        .stdout(append_log(&paths.logs.join("server.log")))
        .stderr(append_log(&paths.logs.join("server.log")));
    let server_child = server_cmd.spawn().map_err(|e| format!("server: {e}"))?;
    *processes.server.lock().unwrap() = Some(server_child);
    if !wait_port(contract.server.port, 240) {
        kill_all(&processes);
        return Err(format!(
            "server did not listen on {} (port busy or crash, see logs)",
            contract.server.port
        ));
    }

    emit_state(app, "starting-proxy", None, None);
    let proxy_jar = layout::component_dir(&paths, &release, "proxy").join(&contract.proxy.jar);
    let mut proxy_cmd = Command::new(&java);
    for flag in &contract.proxy.add_opens {
        proxy_cmd.arg(flag);
    }
    proxy_cmd
        .arg("-cp")
        .arg(&proxy_jar)
        .arg(&contract.proxy.main_class)
        .arg("--wsPort")
        .arg(contract.proxy.ws_port.to_string())
        .arg("--httpPort")
        .arg(contract.proxy.http_port.to_string())
        .current_dir(&paths.root)
        .stdout(append_log(&paths.logs.join("proxy.log")))
        .stderr(append_log(&paths.logs.join("proxy.log")));
    let proxy_child = proxy_cmd.spawn().map_err(|e| format!("proxy: {e}"))?;
    *processes.proxy.lock().unwrap() = Some(proxy_child);
    if !wait_port(contract.proxy.http_port, 120) {
        kill_all(&processes);
        return Err("proxy did not start (see logs)".to_string());
    }
    emit_state(app, "warming", None, None);
    if !wait_log(
        &paths.logs.join("proxy.log"),
        "card db READY",
        600,
    ) {
        kill_all(&processes);
        return Err("proxy card database did not become ready (see logs)".to_string());
    }

    emit_state(app, "ready", None, None);
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }
    Ok(())
}

fn fetch_release(
    app: &AppHandle,
    manifest: &ComponentsManifest,
    target: &str,
    paths: &layout::Paths,
) -> Result<(), String> {
    for name in layout::missing_components(manifest, target, paths) {
        let file = manifest
            .get(&name, target)
            .ok_or_else(|| format!("no {name} for {target}"))?;
        emit_state(app, "downloading", Some(&name), None);
        let archive = layout::component_archive(paths, &manifest.release, &name);
        let component = name.clone();
        let handle = app.clone();
        let mut last_emit = Instant::now() - Duration::from_secs(1);
        let mut progress = |done: u64, total: Option<u64>| {
            if last_emit.elapsed() >= Duration::from_millis(200)
                || total.is_some_and(|t| done >= t)
            {
                last_emit = Instant::now();
                let _ = handle.emit(
                    "bootstrap://progress",
                    ProgressEvent {
                        component: component.clone(),
                        done,
                        total,
                    },
                );
            }
        };
        fetch::download(&file.url, &archive, &mut progress)
            .map_err(|e| format!("download {name}: {e}"))?;
        emit_state(app, "verifying", Some(&name), None);
        if let Err(e) = fetch::verify(&archive, &file.sha256) {
            let _ = std::fs::remove_file(&archive);
            return Err(format!("verify {name}: {e}"));
        }
        emit_state(app, "extracting", Some(&name), None);
        extract::extract_tar_gz(&archive, &layout::component_dir(paths, &manifest.release, &name))
            .map_err(|e| format!("extract {name}: {e}"))?;
    }
    layout::mark_installed(paths, &manifest.release).map_err(|e| format!("mark: {e}"))?;
    Ok(())
}

#[tauri::command]
fn bootstrap_status(app: AppHandle) -> StateEvent {
    app.state::<Bootstrap>()
        .last_state
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
}

#[tauri::command]
fn splash_ready(app: AppHandle) {
    std::thread::spawn(move || run_bootstrap(app));
}

#[tauri::command]
fn retry_bootstrap(app: AppHandle) {
    *app.state::<Bootstrap>().skip_update.lock().unwrap() = false;
    std::thread::spawn(move || run_bootstrap(app));
}

#[tauri::command]
fn skip_update(app: AppHandle) {
    *app.state::<Bootstrap>().skip_update.lock().unwrap() = true;
    std::thread::spawn(move || run_bootstrap(app));
}

#[tauri::command]
fn apply_update(app: AppHandle) {
    std::thread::spawn(move || {
        emit_state(&app, "update-downloading", Some("app"), None);
        let result = tauri::async_runtime::block_on(async {
            let update = app
                .updater_builder()
                .timeout(Duration::from_secs(30))
                .build()
                .map_err(|e| e.to_string())?
                .check()
                .await
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "ya no hay actualización disponible".to_string())?;
            let handle = app.clone();
            let bytes = update
                .download(
                    move |chunk, total| {
                        let _ = handle.emit(
                            "bootstrap://progress",
                            ProgressEvent {
                                component: "app".to_string(),
                                done: chunk as u64,
                                total,
                            },
                        );
                    },
                    || {},
                )
                .await
                .map_err(|e| e.to_string())?;
            update.install(&bytes).map_err(|e| e.to_string())?;
            app.restart();
            #[allow(unreachable_code)]
            Ok::<(), String>(())
        });
        if let Err(message) = result {
            emit_state(
                &app,
                "error",
                None,
                Some(error_code(&format!("actualización: {message}"))),
            );
        }
    });
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    kill_all(&app.state::<Processes>());
    app.exit(0);
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder};
    use tauri::tray::TrayIconBuilder;
    use tauri_plugin_autostart::ManagerExt;

    let autostart = CheckMenuItemBuilder::new("Launch at login")
        .id("autostart")
        .checked(app.autolaunch().is_enabled().unwrap_or(false))
        .build(app)?;
    let menu = MenuBuilder::new(app)
        .item(&autostart)
        .item(&MenuItemBuilder::new("Open data folder").id("data").build(app)?)
        .item(&MenuItemBuilder::new("Restart").id("restart").build(app)?)
        .separator()
        .item(&MenuItemBuilder::new("Quit").id("quit").build(app)?)
        .build()?;
    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => {
                kill_all(&app.state::<Processes>());
                app.exit(0);
            }
            "restart" => app.restart(),
            "data" => {
                let dir = data_root(app);
                let _ = tauri_plugin_opener::reveal_item_in_dir(dir);
            }
            "autostart" => {
                let manager = app.autolaunch();
                let _ = if manager.is_enabled().unwrap_or(false) {
                    manager.disable()
                } else {
                    manager.enable()
                };
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            use tauri::tray::TrayIconEvent;
            if matches!(event, TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. })
            {
                let app = tray.app_handle();
                if let Some(main) = app.get_webview_window("main") {
                    let _ = main.show();
                    let _ = main.set_focus();
                }
            }
        })
        .build(app)?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(Processes {
            server: Mutex::new(None),
            proxy: Mutex::new(None),
        })
        .manage(Bootstrap::initial())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let shown = app
                .get_webview_window("main")
                .map(|w| {
                    let _ = w.show();
                    let _ = w.set_focus();
                })
                .is_some();
            if !shown {
                if let Some(splash) = app.get_webview_window("splash") {
                    let _ = splash.set_focus();
                }
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            splash_ready,
            bootstrap_status,
            retry_bootstrap,
            apply_update,
            skip_update,
            quit_app
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            build_tray(&handle)?;
            std::thread::spawn(move || run_bootstrap(handle));
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { .. } = event {
                    kill_all(&window.state::<Processes>());
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run XMage Nexus");
}

#[cfg(test)]
mod tests {
    use super::{error_code, update_check_due_secs, UPDATE_CHECK_INTERVAL_SECS};

    #[test]
    fn known_errors_map_to_stable_codes() {
        assert_eq!(
            error_code("esta versión solo es compatible con Apple Silicon (arm64): no hay componentes para Mac Intel"),
            "ERR_MAC_INTEL"
        );
        assert_eq!(
            error_code("plataforma no soportada por el instalador"),
            "ERR_PLATFORM"
        );
        assert_eq!(
            error_code("no connection and no downloaded components yet"),
            "ERR_OFFLINE"
        );
        assert_eq!(
            error_code("downloaded runtime is incomplete"),
            "ERR_INCOMPLETE"
        );
        assert_eq!(
            error_code("ya no hay actualización disponible"),
            "ERR_NO_UPDATE"
        );
        assert_eq!(
            error_code("actualización: timeout"),
            "ERR_UPDATE_FAILED|timeout"
        );
    }

    #[test]
    fn unknown_errors_pass_through_verbatim() {
        assert_eq!(error_code("server: boom"), "server: boom");
    }

    #[test]
    fn update_check_due_logic() {
        assert!(update_check_due_secs(0, UPDATE_CHECK_INTERVAL_SECS));
        assert!(update_check_due_secs(100, 100 + UPDATE_CHECK_INTERVAL_SECS));
        assert!(!update_check_due_secs(100, 100 + UPDATE_CHECK_INTERVAL_SECS - 1));
        assert!(!update_check_due_secs(200, 100));
    }
}
