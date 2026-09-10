use crate::manifest::ComponentsManifest;
use std::io;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum LayoutError {
    #[error("io error: {0}")]
    Io(#[from] io::Error),
}

pub const INSTALLED_MARKER: &str = ".installed";

#[derive(Debug, Clone)]
pub struct Paths {
    pub root: PathBuf,
    pub components: PathBuf,
    pub data: PathBuf,
    pub logs: PathBuf,
}

pub fn resolve(data_root: &Path) -> Paths {
    Paths {
        root: data_root.to_path_buf(),
        components: data_root.join("components"),
        data: data_root.join("data"),
        logs: data_root.join("logs"),
    }
}

pub fn release_dir(paths: &Paths, release: &str) -> PathBuf {
    paths.components.join(release)
}

pub fn is_installed(paths: &Paths, release: &str) -> bool {
    release_dir(paths, release).join(INSTALLED_MARKER).is_file()
}

pub fn mark_installed(paths: &Paths, release: &str) -> Result<(), LayoutError> {
    let dir = release_dir(paths, release);
    std::fs::create_dir_all(&dir)?;
    std::fs::write(dir.join(INSTALLED_MARKER), release)?;
    Ok(())
}

pub fn missing_components(
    manifest: &ComponentsManifest,
    target: &str,
    paths: &Paths,
) -> Vec<String> {
    if is_installed(paths, &manifest.release) {
        return Vec::new();
    }
    manifest
        .component_names()
        .into_iter()
        .filter(|name| manifest.get(name, target).is_some())
        .collect()
}

pub fn component_archive(paths: &Paths, release: &str, component: &str) -> PathBuf {
    release_dir(paths, release).join(format!("{component}.tar.gz"))
}

pub fn component_dir(paths: &Paths, release: &str, component: &str) -> PathBuf {
    release_dir(paths, release).join(component)
}

pub fn server_data_dir(paths: &Paths) -> PathBuf {
    paths.data.join("server")
}

pub fn seed_server_data(staging_server: &Path, data_server: &Path) -> Result<(), LayoutError> {
    for sub in ["saved", "gamesHistory"] {
        std::fs::create_dir_all(data_server.join(sub))?;
    }
    let seed = staging_server.join("config");
    if seed.is_dir() {
        let dest = data_server.join("config");
        if !dest.is_dir() {
            copy_dir(&seed, &dest)?;
        }
    }
    let staging_plugins = staging_server.join("plugins");
    if staging_plugins.is_dir() {
        let dest = data_server.join("plugins");
        let _ = std::fs::remove_dir_all(&dest);
        copy_dir(&staging_plugins, &dest)?;
    }
    Ok(())
}

fn copy_dir(src: &Path, dest: &Path) -> Result<(), LayoutError> {
    std::fs::create_dir_all(dest)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let from = entry.path();
        let to = dest.join(entry.file_name());
        if from.is_dir() {
            copy_dir(&from, &to)?;
        } else {
            std::fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_manifest() -> ComponentsManifest {
        ComponentsManifest::parse(
            r#"{"schema":1,"release":"r1","xmage":"x","components":{
                "server": {"t1": {"url": "file:///s", "sha256": "aa", "bytes": 1}},
                "proxy": {"t1": {"url": "file:///p", "sha256": "bb", "bytes": 2}}}}"#,
        )
        .unwrap()
    }

    #[test]
    fn install_lifecycle() {
        let dir = tempfile::tempdir().unwrap();
        let paths = resolve(dir.path());
        let m = sample_manifest();
        assert_eq!(missing_components(&m, "t1", &paths), vec!["proxy", "server"]);
        assert_eq!(missing_components(&m, "other", &paths), Vec::<String>::new());
        mark_installed(&paths, "r1").unwrap();
        assert!(is_installed(&paths, "r1"));
        assert!(missing_components(&m, "t1", &paths).is_empty());
    }

    #[test]
    fn seeds_config_once_and_creates_dirs() {
        let dir = tempfile::tempdir().unwrap();
        let staging = dir.path().join("staging");
        std::fs::create_dir_all(staging.join("config")).unwrap();
        std::fs::write(staging.join("config").join("config.xml"), "<c/>").unwrap();
        std::fs::create_dir_all(staging.join("plugins")).unwrap();
        std::fs::write(staging.join("plugins").join("p-1.jar"), "v1").unwrap();
        let data = dir.path().join("data").join("server");
        seed_server_data(&staging, &data).unwrap();
        assert!(data.join("saved").is_dir());
        assert!(data.join("gamesHistory").is_dir());
        assert_eq!(
            std::fs::read(data.join("config").join("config.xml")).unwrap(),
            b"<c/>"
        );
        assert_eq!(
            std::fs::read(data.join("plugins").join("p-1.jar")).unwrap(),
            b"v1"
        );
        std::fs::write(data.join("config").join("config.xml"), "<user/>").unwrap();
        std::fs::write(staging.join("plugins").join("p-1.jar"), "v2").unwrap();
        seed_server_data(&staging, &data).unwrap();
        assert_eq!(
            std::fs::read(data.join("config").join("config.xml")).unwrap(),
            b"<user/>"
        );
        assert_eq!(
            std::fs::read(data.join("plugins").join("p-1.jar")).unwrap(),
            b"v2"
        );
    }
}
