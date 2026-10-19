use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{self, Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
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
    let mut last = FetchError::Http("no attempt".to_string());
    for attempt in 1..=DOWNLOAD_ATTEMPTS {
        match download_http(url, dest, progress) {
            Ok(()) => return Ok(()),
            Err(e) => {
                last = e;
                if attempt < DOWNLOAD_ATTEMPTS {
                    std::thread::sleep(Duration::from_secs(2 * attempt as u64));
                }
            }
        }
    }
    Err(last)
}

const DOWNLOAD_ATTEMPTS: u32 = 3;
const STALL_LIMIT: Duration = Duration::from_secs(30);

struct Shared {
    done: AtomicU64,
    total: AtomicU64,
    abort: AtomicBool,
    result: Mutex<Option<Result<(), FetchError>>>,
}

fn download_http(
    url: &str,
    dest: &Path,
    progress: &mut dyn FnMut(u64, Option<u64>),
) -> Result<(), FetchError> {
    let shared = Arc::new(Shared {
        done: AtomicU64::new(0),
        total: AtomicU64::new(0),
        abort: AtomicBool::new(false),
        result: Mutex::new(None),
    });
    let worker = shared.clone();
    let url = url.to_string();
    let dest_owned = dest.to_path_buf();
    std::thread::spawn(move || {
        let outcome = stream_http(&url, &dest_owned, &worker);
        if let Ok(mut slot) = worker.result.lock() {
            *slot = Some(outcome);
        }
    });
    progress(0, None);
    let mut last_done = 0u64;
    let mut last_move = Instant::now();
    let mut announced_total = false;
    loop {
        std::thread::sleep(Duration::from_millis(200));
        let done = shared.done.load(Ordering::Relaxed);
        let total = shared.total.load(Ordering::Relaxed);
        if total > 0 && !announced_total {
            announced_total = true;
            progress(done, Some(total));
        } else if done != last_done {
            progress(done, if total > 0 { Some(total) } else { None });
        }
        if done != last_done {
            last_done = done;
            last_move = Instant::now();
        }
        if let Ok(mut slot) = shared.result.lock() {
            if let Some(outcome) = slot.take() {
                return outcome;
            }
        }
        if last_move.elapsed() > STALL_LIMIT {
            shared.abort.store(true, Ordering::Relaxed);
            let _ = std::fs::remove_file(dest.with_extension("part"));
            return Err(FetchError::Http(format!(
                "download stalled: no data for {}s",
                STALL_LIMIT.as_secs()
            )));
        }
    }
}

fn stream_http(url: &str, dest: &Path, shared: &Shared) -> Result<(), FetchError> {
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_resolve(Some(Duration::from_secs(15)))
        .timeout_connect(Some(Duration::from_secs(15)))
        .timeout_recv_response(Some(Duration::from_secs(30)))
        .build()
        .into();
    let response = agent
        .get(url)
        .call()
        .map_err(|e| FetchError::Http(e.to_string()))?;
    let total = response
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok());
    shared.total.store(total.unwrap_or(0), Ordering::Relaxed);
    let mut reader = response.into_body().into_reader();
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = dest.with_extension("part");
    {
        let mut out = File::create(&tmp)?;
        let mut buf = [0u8; 65536];
        let mut downloaded = 0u64;
        loop {
            let n = reader.read(&mut buf)?;
            if shared.abort.load(Ordering::Relaxed) {
                let _ = std::fs::remove_file(&tmp);
                return Err(FetchError::Http("aborted".to_string()));
            }
            if n == 0 {
                break;
            }
            out.write_all(&buf[..n])?;
            downloaded += n as u64;
            shared.done.store(downloaded, Ordering::Relaxed);
        }
        out.flush()?;
    }
    if shared.abort.load(Ordering::Relaxed) {
        let _ = std::fs::remove_file(&tmp);
        return Err(FetchError::Http("aborted".to_string()));
    }
    std::fs::rename(&tmp, dest)?;
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

    #[test]
    fn an_empty_or_malformed_expected_hash_never_verifies() {
        let dir = tempfile::tempdir().unwrap();
        let f = dir.path().join("f");
        std::fs::write(&f, b"data").unwrap();
        let good = sha256_file(&f).unwrap();
        assert!(verify(&f, "").is_err());
        assert!(verify(&f, &good[..good.len() - 1]).is_err());
        assert!(verify(&f, &format!("{good} ")).is_err());
        assert!(verify(&f, &good.to_uppercase()).is_ok());
    }

    #[test]
    fn the_mismatch_error_names_the_file_and_both_hashes() {
        let dir = tempfile::tempdir().unwrap();
        let f = dir.path().join("jre.tar.gz");
        std::fs::write(&f, b"data").unwrap();
        let want = "0".repeat(64);
        let msg = verify(&f, &want).unwrap_err().to_string();
        assert!(msg.contains("jre.tar.gz") && msg.contains(&want) && msg.contains(&sha256_file(&f).unwrap()));
    }

    #[test]
    fn verifying_a_missing_file_is_an_io_error() {
        let dir = tempfile::tempdir().unwrap();
        assert!(matches!(verify(&dir.path().join("nope"), &"0".repeat(64)), Err(FetchError::Io(_))));
    }

    #[test]
    fn a_missing_local_file_url_is_an_error() {
        let dir = tempfile::tempdir().unwrap();
        let mut noop = |_: u64, _: Option<u64>| {};
        assert!(download("file:///definitely/not/here.bin", &dir.path().join("o"), &mut noop).is_err());
        assert!(download_text("file:///definitely/not/here.txt", Duration::from_secs(1)).is_err());
    }

    #[test]
    fn download_text_rejects_unknown_schemes() {
        assert!(matches!(download_text("gopher://x", Duration::from_secs(1)), Err(FetchError::Scheme(_))));
    }
}
