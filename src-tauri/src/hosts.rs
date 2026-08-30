use std::fs;
use std::path::PathBuf;
use std::process::Command;

pub const START: &str = "# >>> focus-start - no editar a mano";
pub const END: &str = "# <<< focus-end";

#[derive(serde::Serialize, Debug)]
pub enum BlockError {
    SinPermisos,
    ArchivoBloqueado,
    Otro(String),
}

pub fn hosts_path() -> PathBuf {
    #[cfg(windows)]
    {
        let root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into());
        PathBuf::from(root).join("System32\\drivers\\etc\\hosts")
    }
    #[cfg(not(windows))]
    {
        PathBuf::from("/etc/hosts")
    }
}

fn backup_path() -> PathBuf {
    let mut p = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    p.push("focus");
    p.push("hosts.backup");
    p
}

fn map_err(e: std::io::Error) -> BlockError {
    match e.raw_os_error() {
        Some(5) => BlockError::SinPermisos,
        Some(32) => BlockError::ArchivoBloqueado,
        _ => BlockError::Otro(e.to_string()),
    }
}

/// Se ejecuta una sola vez, la primera vez que se aplica un bloqueo.
fn asegurar_backup() -> Result<(), BlockError> {
    let bp = backup_path();
    if bp.exists() {
        return Ok(());
    }
    if let Some(dir) = bp.parent() {
        fs::create_dir_all(dir).map_err(map_err)?;
    }
    let contenido = fs::read_to_string(hosts_path()).map_err(map_err)?;
    fs::write(&bp, contenido).map_err(map_err)
}

/// Quita el bloque propio sin tocar el resto del archivo.
fn quitar_bloque(contenido: &str) -> String {
    let mut salida: Vec<&str> = Vec::new();
    let mut dentro = false;
    for linea in contenido.lines() {
        let t = linea.trim();
        if t == START {
            dentro = true;
            continue;
        }
        if t == END {
            dentro = false;
            continue;
        }
        if !dentro {
            salida.push(linea);
        }
    }
    // Sin lineas vacias de sobra al final.
    while salida.last().map_or(false, |l| l.trim().is_empty()) {
        salida.pop();
    }
    salida.join("\r\n")
}

pub fn aplicar(dominios: &[String]) -> Result<(), BlockError> {
    asegurar_backup()?;
    let path = hosts_path();
    let actual = fs::read_to_string(&path).map_err(map_err)?;
    let limpio = quitar_bloque(&actual);

    if dominios.is_empty() {
        fs::write(&path, format!("{}\r\n", limpio)).map_err(map_err)?;
        vaciar_cache_dns();
        return Ok(());
    }

    let mut bloque = String::from(START);
    for d in dominios {
        let d = d.trim().trim_start_matches("www.");
        if d.is_empty() {
            continue;
        }
        // 0.0.0.0 y no 127.0.0.1: falla de inmediato en vez de esperar timeout.
        bloque.push_str(&format!("\r\n0.0.0.0 {}\r\n0.0.0.0 www.{}", d, d));
    }
    bloque.push_str("\r\n");
    bloque.push_str(END);

    fs::write(&path, format!("{}\r\n{}\r\n", limpio, bloque)).map_err(map_err)?;
    vaciar_cache_dns();
    Ok(())
}

pub fn quitar() -> Result<(), BlockError> {
    let path = hosts_path();
    let actual = fs::read_to_string(&path).map_err(map_err)?;
    fs::write(&path, format!("{}\r\n", quitar_bloque(&actual))).map_err(map_err)?;
    vaciar_cache_dns();
    Ok(())
}

pub fn presente() -> bool {
    fs::read_to_string(hosts_path())
        .map(|c| c.contains(START))
        .unwrap_or(false)
}

fn vaciar_cache_dns() {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let _ = Command::new("ipconfig")
            .arg("/flushdns")
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("true").output();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quitar_bloque_deja_el_resto_intacto() {
        let entrada = format!(
            "127.0.0.1 localhost\r\n{}\r\n0.0.0.0 tiktok.com\r\n{}\r\n::1 localhost",
            START, END
        );
        let salida = quitar_bloque(&entrada);
        assert!(salida.contains("127.0.0.1 localhost"));
        assert!(salida.contains("::1 localhost"));
        assert!(!salida.contains("tiktok.com"));
        assert!(!salida.contains(START));
    }

    #[test]
    fn quitar_bloque_es_idempotente() {
        let entrada = "127.0.0.1 localhost";
        assert_eq!(quitar_bloque(entrada), entrada);
    }
}
