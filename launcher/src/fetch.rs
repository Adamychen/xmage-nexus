use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{self, Read, Write};
use std::path::Path;
use std::time::Duration;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum FetchError {
    #[error("http error: {0}")]
    Http(String),
    #[error("io error: {0}")]
    Io(#[from] io::Error),
    #[error("hash mismatch for {0}: expected {1}, got {2}")]
    HashMismatch(String, String, String),
    #[error("unsupported url scheme: {0}")]
    Scheme(String),
}

pub fn download_text(url: &str, timeout: Duration) -> Result<String, FetchError> {
    if let Some(path) = url.strip_prefix("file://") {
        return std::fs::read_to_string(path).map_err(FetchError::Io);
    }
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err(FetchError::Scheme(url.to_string()));
    }
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(timeout))
        .build()
        .into();
    let mut reader = agent
        .get(url)
        .call()
        .map_err(|e| FetchError::Http(e.to_string()))?
        .into_body()
        .into_reader();
    let mut text = String::new();
    reader.read_to_string(&mut text)?;
    Ok(text)
}

pub fn download(
    url: &str,
    dest: &Path,
    progress: &mut dyn FnMut(u64, Option<u64>),
) -> Result<(), FetchError> {
    if let Some(path) = url.strip_prefix("file://") {
        return copy_local(Path::new(path), dest, progress);
    }
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err(FetchError::Scheme(url.to_string()));
    }
    let response = ureq::get(url)
        .call()
        .map_err(|e| FetchError::Http(e.to_string()))?;
    let total = response
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok());
    progress(0, total);
    let mut reader = response.into_body().into_reader();
    write_stream(&mut reader, dest, progress)?;
    Ok(())
}

fn copy_local(
    src: &Path,
    dest: &Path,
    progress: &mut dyn FnMut(u64, Option<u64>),
) -> Result<(), FetchError> {
    let total = src.metadata().ok().map(|m| m.len());
    progress(0, total);
    let mut reader = File::open(src)?;
    write_stream(&mut reader, dest, progress)?;
    Ok(())
}

fn write_stream(
    reader: &mut dyn Read,
    dest: &Path,
    progress: &mut dyn FnMut(u64, Option<u64>),
) -> Result<(), FetchError> {
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = dest.with_extension("part");
    let mut downloaded: u64 = 0;
    {
        let mut out = File::create(&tmp)?;
        let mut buf = [0u8; 65536];
        loop {
            let n = reader.read(&mut buf)?;
            if n == 0 {
                break;
            }
            out.write_all(&buf[..n])?;
            downloaded += n as u64;
            progress(downloaded, None);
        }
        out.flush()?;
    }
    std::fs::rename(&tmp, dest)?;
    Ok(())
}

pub fn sha256_file(path: &Path) -> Result<String, FetchError> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

pub fn verify(path: &Path, expected_hex: &str) -> Result<(), FetchError> {
    let actual = sha256_file(path)?;
    if actual.eq_ignore_ascii_case(expected_hex) {
        Ok(())
    } else {
        Err(FetchError::HashMismatch(
            path.display().to_string(),
            expected_hex.to_string(),
            actual,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_url_download_reports_progress_and_verifies() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("src.bin");
        std::fs::write(&src, vec![7u8; 100_000]).unwrap();
        let dest = dir.path().join("sub").join("dest.bin");
        let mut seen = Vec::new();
        let url = format!("file://{}", src.display());
        download(&url, &dest, &mut |done: u64, total: Option<u64>| {
            seen.push((done, total));
        })
        .unwrap();
        assert_eq!(std::fs::read(&dest).unwrap().len(), 100_000);
        assert!(seen.iter().any(|(done, _)| *done == 100_000));
        assert!(seen.iter().any(|(_, total)| *total == Some(100_000)));
        let hex = sha256_file(&dest).unwrap();
        assert!(verify(&dest, &hex).is_ok());
        assert!(verify(&dest, &"0".repeat(64)).is_err());
    }

    #[test]
    fn rejects_unknown_scheme() {
        let dir = tempfile::tempdir().unwrap();
        let mut noop = |_: u64, _: Option<u64>| {};
        assert!(download("ftp://x/y", &dir.path().join("o"), &mut noop).is_err());
    }
}
