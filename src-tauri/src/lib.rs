mod hosts;

use hosts::BlockError;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

// ---------------------------------------------------------------------------
// Estado del bloqueo. Vive en Rust y NO en el frontend: si se cierra la
// ventana con un pase activo, el bloqueo tiene que volver igual (6.3).
// ---------------------------------------------------------------------------
#[derive(Default)]
struct Estado {
    dominios: Vec<String>,
    /// true cuando el bloqueo esta puesto (aunque haya un pase corriendo).
    activo: bool,
    /// Epoch en segundos. Some(_) mientras haya un pase vigente.
    pase_vence_en: Option<u64>,
}

type EstadoApp = Arc<Mutex<Estado>>;

fn ahora() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn store_path() -> PathBuf {
    let mut p = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    p.push("focus");
    p.push("store.json");
    p
}

#[tauri::command]
fn cargar_store() -> Result<Value, String> {
    let p = store_path();
    if !p.exists() {
        return Err("no existe".into());
    }
    let txt = fs::read_to_string(&p).map_err(|e| e.to_string())?;
    serde_json::from_str(&txt).map_err(|e| e.to_string())
}

#[tauri::command]
fn guardar_store(store: Value) -> Result<(), String> {
    let p = store_path();
    if let Some(dir) = p.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    // Escritura atomica: temporal + rename.
    let tmp = p.with_extension("json.tmp");
    fs::write(
        &tmp,
        serde_json::to_string_pretty(&store).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(&tmp, &p).map_err(|e| e.to_string())
}

#[tauri::command]
fn aplicar_bloqueo(
    dominios: Vec<String>,
    estado: tauri::State<'_, EstadoApp>,
) -> Result<(), BlockError> {
    hosts::aplicar(&dominios)?;
    let mut e = estado.lock().unwrap();
    e.dominios = dominios;
    e.activo = true;
    e.pase_vence_en = None;
    drop(e);
    Ok(())
}

#[tauri::command]
fn quitar_bloqueo(estado: tauri::State<'_, EstadoApp>) -> Result<(), BlockError> {
    hosts::quitar()?;
    let mut e = estado.lock().unwrap();
    e.activo = false;
    e.pase_vence_en = None;
    Ok(())
}

#[tauri::command]
fn bloqueo_presente() -> bool {
    hosts::presente()
}

#[tauri::command]
fn programar_pase(
    minutos: u64,
    dominios: Vec<String>,
    estado: tauri::State<'_, EstadoApp>,
) -> Result<(), BlockError> {
    hosts::quitar()?;
    let mut e = estado.lock().unwrap();
    e.dominios = dominios;
    e.activo = true;
    e.pase_vence_en = Some(ahora() + minutos * 60);
    Ok(())
}

#[tauri::command]
fn cancelar_pase(estado: tauri::State<'_, EstadoApp>) -> Result<(), BlockError> {
    let dominios = {
        let mut e = estado.lock().unwrap();
        e.pase_vence_en = None;
        if !e.activo {
            return Ok(());
        }
        e.dominios.clone()
    };
    hosts::aplicar(&dominios)
}

#[tauri::command]
fn es_admin() -> bool {
    #[cfg(windows)]
    {
        use std::fs::OpenOptions;
        OpenOptions::new()
            .append(true)
            .open(hosts::hosts_path())
            .is_ok()
    }
    #[cfg(not(windows))]
    {
        true
    }
}

/// Vigilante del pase: revierte el bloqueo cuando el pase vence.
/// Corre cada 5 segundos. No puede vivir en el frontend: si se cierra la
/// ventana con un pase activo, el bloqueo tiene que volver igual.
fn lanzar_vigilante(estado: EstadoApp) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(5));

        let reaplicar = {
            let mut e = match estado.lock() {
                Ok(g) => g,
                Err(_) => continue,
            };
            match e.pase_vence_en {
                Some(t) if e.activo && ahora() >= t => {
                    e.pase_vence_en = None;
                    Some(e.dominios.clone())
                }
                _ => None,
            }
        };

        if let Some(dominios) = reaplicar {
            let _ = hosts::aplicar(&dominios);
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let estado: EstadoApp = Arc::new(Mutex::new(Estado::default()));
    lanzar_vigilante(estado.clone());

    tauri::Builder::default()
        .manage(estado)
        .invoke_handler(tauri::generate_handler![
            cargar_store,
            guardar_store,
            aplicar_bloqueo,
            quitar_bloqueo,
            bloqueo_presente,
            programar_pase,
            cancelar_pase,
            es_admin
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicacion");
}
