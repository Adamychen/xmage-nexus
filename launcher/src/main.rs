use nexus_launcher::{current_target, extract, fetch, layout, manifest::ComponentsManifest};
use std::path::PathBuf;

fn usage() -> ! {
    eprintln!("usage: nexus-bootstrap <check|fetch> --data-dir DIR --manifest FILE|URL [--target TAG]");
    std::process::exit(2);
}

fn arg_value(args: &[String], name: &str) -> Option<String> {
    args.windows(2)
        .find(|w| w[0] == name)
        .map(|w| w[1].clone())
}

fn load_manifest(spec: &str) -> ComponentsManifest {
    if spec.starts_with("https://") || spec.starts_with("http://") {
        let tmp = std::env::temp_dir().join("nexus-manifest.json");
        let mut progress = |_: u64, _: Option<u64>| {};
        fetch::download(spec, &tmp, &mut progress).unwrap_or_else(|e| {
            eprintln!("manifest download failed: {e}");
            std::process::exit(1);
        });
        let text = std::fs::read_to_string(&tmp).unwrap_or_else(|e| {
            eprintln!("manifest read failed: {e}");
            std::process::exit(1);
        });
        ComponentsManifest::parse(&text).unwrap_or_else(|e| {
            eprintln!("manifest parse failed: {e}");
            std::process::exit(1);
        })
    } else {
        let text = std::fs::read_to_string(spec).unwrap_or_else(|e| {
            eprintln!("manifest read failed: {e}");
            std::process::exit(1);
        });
        ComponentsManifest::parse(&text).unwrap_or_else(|e| {
            eprintln!("manifest parse failed: {e}");
            std::process::exit(1);
        })
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        usage();
    }
    let cmd = args[1].as_str();
    let data_dir = arg_value(&args, "--data-dir").map(PathBuf::from).unwrap_or_else(|| usage());
    let manifest_spec = arg_value(&args, "--manifest").unwrap_or_else(|| usage());
    let target = arg_value(&args, "--target").unwrap_or_else(current_target);

    let manifest = load_manifest(&manifest_spec);
    let paths = layout::resolve(&data_dir);

    match cmd {
        "check" => {
            let missing = layout::missing_components(&manifest, &target, &paths);
            if missing.is_empty() {
                println!("up-to-date: {}", manifest.release);
            } else {
                println!("missing for {}: {}", manifest.release, missing.join(", "));
                std::process::exit(1);
            }
        }
        "fetch" => {
            let missing = layout::missing_components(&manifest, &target, &paths);
            if missing.is_empty() {
                println!("up-to-date: {}", manifest.release);
                return;
            }
            for name in &missing {
                let file = manifest.get(name, &target).unwrap_or_else(|| {
                    eprintln!("no {name} for target {target}");
                    std::process::exit(1);
                });
                let archive = layout::component_archive(&paths, &manifest.release, name);
                eprintln!("downloading {name} ({} bytes)…", file.bytes);
                let mut total: Option<u64> = None;
                let mut progress = |done: u64, t: Option<u64>| {
                    if t.is_some() {
                        total = t;
                    }
                    match total {
                        Some(n) => eprintln!("  {name}: {done}/{n}"),
                        None => eprintln!("  {name}: {done}"),
                    }
                };
                if let Err(e) = fetch::download(&file.url, &archive, &mut progress) {
                    eprintln!("download failed: {e}");
                    std::process::exit(1);
                }
                if let Err(e) = fetch::verify(&archive, &file.sha256) {
                    eprintln!("verify failed: {e}");
                    let _ = std::fs::remove_file(&archive);
                    std::process::exit(1);
                }
                let dir = layout::component_dir(&paths, &manifest.release, name);
                if let Err(e) = extract::extract_tar_gz(&archive, &dir) {
                    eprintln!("extract failed: {e}");
                    std::process::exit(1);
                }
                eprintln!("{name}: installed");
            }
            if let Err(e) = layout::seed_server_data(
                &layout::component_dir(&paths, &manifest.release, "server"),
                &layout::server_data_dir(&paths),
            ) {
                eprintln!("seed failed: {e}");
                std::process::exit(1);
            }
            if let Err(e) = layout::mark_installed(&paths, &manifest.release) {
                eprintln!("mark failed: {e}");
                std::process::exit(1);
            }
            println!("installed: {}", manifest.release);
        }
        _ => usage(),
    }
}
