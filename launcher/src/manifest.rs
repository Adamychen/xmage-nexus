use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentFile {
    pub url: String,
    pub sha256: String,
    pub bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentsManifest {
    pub schema: u32,
    pub release: String,
    pub xmage: String,
    #[serde(default)]
    pub git_sha: String,
    #[serde(default)]
    pub min_launcher: String,
    pub components: HashMap<String, HashMap<String, ComponentFile>>,
}

impl ComponentsManifest {
    pub fn parse(json: &str) -> serde_json::Result<Self> {
        serde_json::from_str(json)
    }

    pub fn get(&self, component: &str, target: &str) -> Option<&ComponentFile> {
        self.components.get(component)?.get(target)
    }

    pub fn component_names(&self) -> Vec<String> {
        let mut names: Vec<String> = self.components.keys().cloned().collect();
        names.sort();
        names
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
        "schema": 1,
        "release": "1.4.62-1",
        "xmage": "1.4.62-V1",
        "git_sha": "abc123",
        "components": {
            "jre": {"mac-arm64": {"url": "https://x/jre.tar.gz", "sha256": "aa", "bytes": 42}},
            "server": {"mac-arm64": {"url": "https://x/s.tar.gz", "sha256": "bb", "bytes": 7}},
            "proxy": {"mac-arm64": {"url": "https://x/p.tar.gz", "sha256": "cc", "bytes": 9}}
        }
    }"#;

    #[test]
    fn parses_and_resolves_targets() {
        let m = ComponentsManifest::parse(SAMPLE).unwrap();
        assert_eq!(m.release, "1.4.62-1");
        assert_eq!(m.get("server", "mac-arm64").unwrap().bytes, 7);
        assert!(m.get("server", "win-x64").is_none());
        assert!(m.get("nope", "mac-arm64").is_none());
        assert_eq!(m.component_names(), vec!["jre", "proxy", "server"]);
    }

    #[test]
    fn rejects_garbage() {
        assert!(ComponentsManifest::parse("not json").is_err());
    }

    #[test]
    fn a_manifest_missing_required_fields_is_rejected() {
        assert!(ComponentsManifest::parse("{}").is_err());
        assert!(ComponentsManifest::parse(r#"{"schema":1,"release":"r","xmage":"x"}"#).is_err());
        let no_hash = r#"{"schema":1,"release":"r","xmage":"x","components":{"jre":{"t":{"url":"https://x","bytes":1}}}}"#;
        assert!(ComponentsManifest::parse(no_hash).is_err());
    }

    #[test]
    fn optional_fields_default_to_empty() {
        let m = ComponentsManifest::parse(r#"{"schema":1,"release":"r","xmage":"x","components":{}}"#).unwrap();
        assert_eq!(m.git_sha, "");
        assert_eq!(m.min_launcher, "");
        assert!(m.component_names().is_empty());
    }

    #[test]
    fn wrong_types_are_rejected() {
        let bad = r#"{"schema":"one","release":"r","xmage":"x","components":{}}"#;
        assert!(ComponentsManifest::parse(bad).is_err());
        let neg = r#"{"schema":1,"release":"r","xmage":"x","components":{"jre":{"t":{"url":"u","sha256":"s","bytes":-1}}}}"#;
        assert!(ComponentsManifest::parse(neg).is_err());
    }
}
