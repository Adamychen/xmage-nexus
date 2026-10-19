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
        if entry.header().entry_type().is_symlink() || entry.header().entry_type().is_hard_link() {
            let link = entry
                .link_name()?
                .map(|l| l.to_path_buf())
                .unwrap_or_default();
            let hard = entry.header().entry_type().is_hard_link();
            if !link_stays_inside(&path, &link, hard) {
                return Err(ExtractError::UnsafeEntry(format!(
                    "{} -> {}",
                    path.display(),
                    link.display()
                )));
            }
        }
        let target = dest.join(path);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)?;
        }
        entry.unpack(target)?;
    }
    Ok(())
}

fn link_stays_inside(entry: &Path, link: &Path, hard: bool) -> bool {
    if link.has_root() || link.components().any(|c| matches!(c, Component::Prefix(_))) {
        return false;
    }
    let mut depth: i64 = 0;
    if !hard {
        let parent_depth = entry.components().count().saturating_sub(1) as i64;
        depth = parent_depth;
    }
    for c in link.components() {
        match c {
            Component::ParentDir => {
                depth -= 1;
                if depth < 0 {
                    return false;
                }
            }
            Component::Normal(_) => depth += 1,
            _ => {}
        }
    }
    true
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

    fn archive_with_symlink(dir: &Path, link_name: &str, target: &str, then_file: &str) -> std::path::PathBuf {
        let archive = dir.join("evil.tar.gz");
        let f = File::create(&archive).unwrap();
        let mut builder = tar::Builder::new(GzEncoder::new(f, Compression::fast()));
        let mut link = tar::Header::new_gnu();
        link.set_entry_type(tar::EntryType::Symlink);
        link.set_size(0);
        link.set_mode(0o777);
        builder.append_link(&mut link, link_name, target).unwrap();
        let mut header = tar::Header::new_gnu();
        header.set_size(4);
        header.set_mode(0o644);
        header.set_cksum();
        builder.append_data(&mut header, then_file, &b"evil"[..]).unwrap();
        builder.into_inner().unwrap().finish().unwrap();
        archive
    }

    #[test]
    fn a_symlink_out_of_the_destination_cannot_be_used_to_write_outside() {
        let dir = tempfile::tempdir().unwrap();
        let outside = dir.path().join("outside");
        std::fs::create_dir_all(&outside).unwrap();
        let archive = archive_with_symlink(dir.path(), "jre", outside.to_str().unwrap(), "jre/owned.txt");
        let dest = dir.path().join("out");
        let _ = extract_tar_gz(&archive, &dest);
        assert!(!outside.join("owned.txt").exists(), "wrote through a symlink to {}", outside.display());
    }

    #[test]
    fn a_relative_symlink_climbing_out_cannot_be_used_to_write_outside() {
        let dir = tempfile::tempdir().unwrap();
        let archive = archive_with_symlink(dir.path(), "up", "../../", "up/owned.txt");
        let dest = dir.path().join("a").join("b").join("out");
        let _ = extract_tar_gz(&archive, &dest);
        assert!(!dir.path().join("a").join("owned.txt").exists());
        assert!(!dir.path().join("owned.txt").exists());
    }

    #[test]
    fn links_that_stay_inside_are_allowed() {
        assert!(link_stays_inside(Path::new("jre/bin/java"), Path::new("../lib/jspawnhelper"), false));
        assert!(link_stays_inside(Path::new("jre/lib/a"), Path::new("b"), false));
        assert!(link_stays_inside(Path::new("jre/lib/a"), Path::new("jre/lib/b"), true));
        assert!(!link_stays_inside(Path::new("jre/lib/a"), Path::new("../../../x"), false));
        assert!(!link_stays_inside(Path::new("a"), Path::new("/etc"), false));
        assert!(!link_stays_inside(Path::new("a"), Path::new("../x"), true));
    }

    #[test]
    fn a_truncated_archive_is_an_error_not_a_panic() {
        let dir = tempfile::tempdir().unwrap();
        let archive = make_archive(dir.path(), &[("srv/config.xml", &[1u8; 50_000][..])]);
        let bytes = std::fs::read(&archive).unwrap();
        std::fs::write(&archive, &bytes[..bytes.len() / 2]).unwrap();
        assert!(extract_tar_gz(&archive, &dir.path().join("out")).is_err());
    }

    #[test]
    fn a_missing_archive_is_an_error() {
        let dir = tempfile::tempdir().unwrap();
        assert!(extract_tar_gz(&dir.path().join("nope.tar.gz"), &dir.path().join("out")).is_err());
    }

    #[test]
    fn a_file_that_is_not_gzip_is_an_error() {
        let dir = tempfile::tempdir().unwrap();
        let archive = dir.path().join("a.tar.gz");
        std::fs::write(&archive, b"this is not a tarball").unwrap();
        assert!(extract_tar_gz(&archive, &dir.path().join("out")).is_err());
    }
}
