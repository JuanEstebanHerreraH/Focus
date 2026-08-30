use std::collections::HashSet;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Procesos que NUNCA se cierran, sin importar lo que diga la lista.
/// Matar cualquiera de estos deja el sistema inutilizable o fuerza reinicio.
/// La verificacion vive en Rust y no en el frontend a proposito: es un
/// guardarrail, no una preferencia.
const PROTEGIDOS: &[&str] = &[
    "system", "system idle process", "registry", "smss.exe", "csrss.exe",
    "wininit.exe", "winlogon.exe", "services.exe", "lsass.exe", "lsm.exe",
    "svchost.exe", "explorer.exe", "dwm.exe", "fontdrvhost.exe",
    "sihost.exe", "ctfmon.exe", "taskhostw.exe", "runtimebroker.exe",
    "shellexperiencehost.exe", "startmenuexperiencehost.exe",
    "searchhost.exe", "textinputhost.exe", "audiodg.exe", "conhost.exe",
    "wudfhost.exe", "spoolsv.exe", "msmpeng.exe", "securityhealthservice.exe",
    // La propia aplicacion, por si alguien la agrega a la lista.
    "focus.exe", "foco.exe",
];

pub fn es_protegido(nombre: &str) -> bool {
    let n = nombre.trim().to_lowercase();
    PROTEGIDOS.contains(&n.as_str())
}

/// Nombres de ejecutables actualmente en memoria, sin repetir y sin los
/// protegidos. Sirve para que el usuario elija de una lista real en vez de
/// escribir nombres a mano y equivocarse.
pub fn listar() -> Vec<String> {
    #[cfg(windows)]
    {
        let salida = Command::new("tasklist")
            .args(["/FO", "CSV", "/NH"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
        let Ok(o) = salida else { return Vec::new() };
        let texto = String::from_utf8_lossy(&o.stdout);
        let mut vistos: HashSet<String> = HashSet::new();
        let mut r: Vec<String> = texto
            .lines()
            .filter_map(|l| {
                // Formato CSV: "nombre.exe","PID","Sesion",...
                let nombre = l.split("\",\"").next()?.trim_start_matches('"');
                if nombre.is_empty() || es_protegido(nombre) {
                    return None;
                }
                if vistos.insert(nombre.to_lowercase()) {
                    Some(nombre.to_string())
                } else {
                    None
                }
            })
            .collect();
        r.sort_by_key(|a| a.to_lowercase());
        r
    }
    #[cfg(not(windows))]
    {
        Vec::new()
    }
}

/// Cierra los procesos indicados. Devuelve los que efectivamente se cerraron.
/// Los protegidos se descartan en silencio.
pub fn matar(nombres: &[String]) -> Vec<String> {
    let mut cerrados = Vec::new();
    #[cfg(windows)]
    for n in nombres {
        let n = n.trim();
        if n.is_empty() || es_protegido(n) {
            continue;
        }
        let nombre = if n.to_lowercase().ends_with(".exe") {
            n.to_string()
        } else {
            format!("{}.exe", n)
        };
        let r = Command::new("taskkill")
            .args(["/F", "/IM", &nombre])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
        // taskkill devuelve 128 si el proceso no estaba corriendo: no es error.
        if let Ok(o) = r {
            if o.status.success() {
                cerrados.push(nombre);
            }
        }
    }
    #[cfg(not(windows))]
    let _ = nombres;
    cerrados
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn protege_procesos_del_sistema() {
        assert!(es_protegido("explorer.exe"));
        assert!(es_protegido("EXPLORER.EXE"));
        assert!(es_protegido(" svchost.exe "));
        assert!(!es_protegido("Discord.exe"));
    }

    #[test]
    fn no_mata_protegidos_aunque_se_pidan() {
        let cerrados = matar(&["explorer.exe".to_string()]);
        assert!(cerrados.is_empty());
    }
}
