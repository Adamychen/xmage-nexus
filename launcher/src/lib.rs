pub mod extract;
pub mod fetch;
pub mod layout;
pub mod manifest;

pub fn current_target() -> String {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    match (os, arch) {
        ("linux", "x86_64") => "linux-x64",
        ("windows", "x86_64") => "win-x64",
        ("macos", "aarch64") => "mac-arm64",
        ("macos", "x86_64") => "mac-x64",
        _ => "unknown",
    }
    .to_string()
}
