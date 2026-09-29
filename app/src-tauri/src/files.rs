//! Disk files the user opens, plus the private app store (%APPDATA%\Notepad2).

use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Serialize, Debug, PartialEq)]
pub struct FileStat {
    pub exists: bool,
    /// Milliseconds since the Unix epoch, same unit as JS Date.now().
    pub mtime: f64,
    pub size: u64,
    pub readonly: bool,
}

pub fn mtime_ms(meta: &fs::Metadata) -> f64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as f64)
        .unwrap_or(0.0)
}

pub fn stat(path: &Path) -> FileStat {
    match fs::metadata(path) {
        Ok(m) => FileStat { exists: true, mtime: mtime_ms(&m), size: m.len(), readonly: m.permissions().readonly() },
        Err(_) => FileStat { exists: false, mtime: 0.0, size: 0, readonly: false },
    }
}

/// Atomic replace: write a sibling temp file, fsync, rename over the target.
/// A crash mid-save leaves either the old file or the new one, never half of each.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> Result<f64, String> {
    let dir = path.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or(Path::new("."));
    let name = path.file_name().ok_or("Invalid file name")?.to_string_lossy().into_owned();
    if let Ok(m) = fs::metadata(path) {
        if m.permissions().readonly() {
            return Err(format!("{name} is read-only."));
        }
    }
    let tmp = dir.join(format!(".{name}.{}.np2tmp", std::process::id()));
    let result = (|| -> std::io::Result<()> {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
        drop(f);
        fs::rename(&tmp, path)
    })();
    if let Err(e) = result {
        let _ = fs::remove_file(&tmp);
        return Err(format!("Could not save {name}: {e}"));
    }
    Ok(stat(path).mtime)
}

/// Resolve a store key ("notes/abc.md") under the store root, refusing anything that escapes it.
/// Rename a file, refusing to replace an existing one (Windows' rename would overwrite it).
/// A change of letter case only (a.txt -> A.txt) is allowed.
pub fn rename_no_overwrite(from: &Path, to: &Path) -> Result<(), String> {
    let case_only = from.to_string_lossy().to_lowercase() == to.to_string_lossy().to_lowercase();
    if !case_only && to.exists() {
        return Err(format!("{} already exists", to.display()));
    }
    fs::rename(from, to).map_err(|e| e.to_string())
}

pub fn store_path(root: &Path, key: &str) -> Result<PathBuf, String> {
    let rel = Path::new(key);
    if key.is_empty() || rel.is_absolute() {
        return Err("Bad store key".into());
    }
    for c in rel.components() {
        match c {
            Component::Normal(_) => {}
            _ => return Err("Bad store key".into()),
        }
    }
    // Windows would also accept "C:foo" and "\\?\" forms; Component checks above reject them.
    Ok(root.join(rel))
}

pub fn store_write(root: &Path, key: &str, text: &str) -> Result<(), String> {
    let p = store_path(root, key)?;
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    write_atomic(&p, text.as_bytes()).map(|_| ())
}

pub fn store_read(root: &Path, key: &str) -> Result<Option<String>, String> {
    let p = store_path(root, key)?;
    match fs::read(&p) {
        Ok(b) => Ok(Some(String::from_utf8_lossy(&b).into_owned())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Atomically take a store file: rename it away, then read and delete it. Only one caller can
/// win; the others get None. Used for hand-overs between windows.
pub fn store_claim(root: &Path, key: &str) -> Result<Option<String>, String> {
    let p = store_path(root, key)?;
    let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let claimed = p.with_extension(format!("claim-{}-{nanos}", std::process::id()));
    match fs::rename(&p, &claimed) {
        Ok(()) => {
            let text = fs::read_to_string(&claimed).map_err(|e| e.to_string());
            let _ = fs::remove_file(&claimed);
            text.map(Some)
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn store_delete(root: &Path, key: &str) -> Result<(), String> {
    let p = store_path(root, key)?;
    match fs::remove_file(&p) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn store_list(root: &Path, dir: &str) -> Result<Vec<String>, String> {
    let p = if dir.is_empty() { root.to_path_buf() } else { store_path(root, dir)? };
    let rd = match fs::read_dir(&p) {
        Ok(r) => r,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
        Err(e) => return Err(e.to_string()),
    };
    let mut out: Vec<String> = rd
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| !n.ends_with(".np2tmp"))
        .collect();
    out.sort();
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmpdir(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("np2-test-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn claim_is_won_once() {
        let d = tmpdir("claim");
        store_write(&d, "transfers/t1.json", "payload").unwrap();
        assert_eq!(store_claim(&d, "transfers/t1.json").unwrap(), Some("payload".to_string()));
        assert_eq!(store_claim(&d, "transfers/t1.json").unwrap(), None); // second claimer loses
        assert_eq!(store_read(&d, "transfers/t1.json").unwrap(), None);
        assert_eq!(store_claim(&d, "transfers/none.json").unwrap(), None);
        fs::remove_dir_all(d).unwrap();
    }

    #[test]
    fn rename_moves_the_file() {
        let d = tmpdir("ren");
        let a = d.join("a.txt");
        let b = d.join("b.txt");
        fs::write(&a, b"hello").unwrap();
        rename_no_overwrite(&a, &b).unwrap();
        assert!(!a.exists());
        assert_eq!(fs::read(&b).unwrap(), b"hello");
        fs::remove_dir_all(d).unwrap();
    }

    #[test]
    fn rename_never_overwrites() {
        let d = tmpdir("ren2");
        let a = d.join("a.txt");
        let b = d.join("b.txt");
        fs::write(&a, b"new").unwrap();
        fs::write(&b, b"keep me").unwrap();
        assert!(rename_no_overwrite(&a, &b).is_err());
        assert_eq!(fs::read(&b).unwrap(), b"keep me");
        assert_eq!(fs::read(&a).unwrap(), b"new");
        fs::remove_dir_all(d).unwrap();
    }

    #[test]
    fn store_keys_cannot_escape_root() {
        let root = Path::new("/r");
        assert!(store_path(root, "notes/a.md").is_ok());
        assert!(store_path(root, "../x").is_err());
        assert!(store_path(root, "notes/../../x").is_err());
        assert!(store_path(root, "/etc/passwd").is_err());
        assert!(store_path(root, "").is_err());
    }

    #[test]
    fn atomic_write_round_trips_bytes_exactly() {
        let d = tmpdir("rt");
        let p = d.join("a.txt");
        let bytes = b"\xEF\xBB\xBFline1\r\nline2\rline3\n";
        let m = write_atomic(&p, bytes).unwrap();
        assert!(m > 0.0);
        assert_eq!(fs::read(&p).unwrap(), bytes);
        write_atomic(&p, b"x").unwrap();
        assert_eq!(fs::read(&p).unwrap(), b"x");
        assert!(fs::read_dir(&d).unwrap().count() == 1, "temp file left behind");
        fs::remove_dir_all(d).unwrap();
    }

    #[test]
    fn store_crud() {
        let d = tmpdir("store");
        assert_eq!(store_read(&d, "notes/x.md").unwrap(), None);
        store_write(&d, "notes/x.md", "hi").unwrap();
        store_write(&d, "notes/y.md", "yo").unwrap();
        assert_eq!(store_read(&d, "notes/x.md").unwrap().as_deref(), Some("hi"));
        assert_eq!(store_list(&d, "notes").unwrap(), vec!["x.md", "y.md"]);
        store_delete(&d, "notes/x.md").unwrap();
        store_delete(&d, "notes/x.md").unwrap();
        assert_eq!(store_list(&d, "notes").unwrap(), vec!["y.md"]);
        assert_eq!(store_list(&d, "missing").unwrap(), Vec::<String>::new());
        fs::remove_dir_all(d).unwrap();
    }

    #[test]
    fn stat_missing_file() {
        let s = stat(Path::new("/definitely/not/here.txt"));
        assert!(!s.exists);
    }
}
