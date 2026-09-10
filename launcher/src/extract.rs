use flate2::read::GzDecoder;
use std::fs::File;
use std::io;
use std::path::{Component, Path};
use tar::Archive;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ExtractError {
    #[error("io error: {0}")]
    Io(#[from] io::Error),
    #[error("unsafe entry in archive: {0}")]
    UnsafeEntry(String),
}

pub fn extract_tar_gz(archive: &Path, dest: &Path) -> Result<(), ExtractError> {
    std::fs::create_dir_all(dest)?;
    let file = File::open(archive)?;
    let mut ar = Archive::new(GzDecoder::new(file));
    for entry in ar.entries()? {
        let mut entry = entry?;
        let path = entry.path()?.to_path_buf();
        if !is_safe_entry(&path) {
            return Err(ExtractError::UnsafeEntry(path.display().to_string()));
        }
        let target = dest.join(path);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)?;
        }
        entry.unpack(target)?;
    }
    Ok(())
}

fn is_safe_entry(path: &Path) -> bool {
    !path.components().any(|c| {
        matches!(
            c,
            Component::ParentDir | Component::Prefix(_) | Component::RootDir
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use flate2::{write::GzEncoder, Compression};

    fn make_archive(dir: &Path, files: &[(&str, &[u8])]) -> std::path::PathBuf {
        let archive = dir.join("a.tar.gz");
        let f = File::create(&archive).unwrap();
        let mut builder = tar::Builder::new(GzEncoder::new(f, Compression::fast()));
        for (name, data) in files {
            let mut header = tar::Header::new_gnu();
            header.set_size(data.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            builder.append_data(&mut header, name, *data).unwrap();
        }
        builder.into_inner().unwrap().finish().unwrap();
        archive
    }

    #[test]
    fn roundtrips_files() {
        let dir = tempfile::tempdir().unwrap();
        let archive = make_archive(dir.path(), &[("srv/config.xml", b"<x/>")]);
        let dest = dir.path().join("out");
        extract_tar_gz(&archive, &dest).unwrap();
        assert_eq!(std::fs::read(dest.join("srv/config.xml")).unwrap(), b"<x/>");
    }

    #[test]
    fn rejects_unsafe_entries() {
        assert!(!is_safe_entry(Path::new("../../evil")));
        assert!(!is_safe_entry(Path::new("/abs/evil")));
        assert!(!is_safe_entry(Path::new("a/../../b")));
        assert!(is_safe_entry(Path::new("srv/config.xml")));
        assert!(is_safe_entry(Path::new("jre/bin/java")));
    }
}
