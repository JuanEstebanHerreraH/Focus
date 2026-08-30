import { invoke } from "@tauri-apps/api/core";
import type { Store } from "./types";

export type BlockError =
  | "SinPermisos"
  | "ArchivoBloqueado"
  | { Otro: string };

export async function cargarStore(): Promise<Store> {
  return await invoke<Store>("cargar_store");
}

export async function guardarStore(store: Store): Promise<void> {
  await invoke("guardar_store", { store });
}

export async function aplicarBloqueo(dominios: string[]): Promise<void> {
  await invoke("aplicar_bloqueo", { dominios });
}

export async function quitarBloqueo(): Promise<void> {
  await invoke("quitar_bloqueo");
}

/** true si el bloque propio esta presente en el archivo hosts. */
export async function bloqueoPresente(): Promise<boolean> {
  return await invoke<boolean>("bloqueo_presente");
}

export async function esAdmin(): Promise<boolean> {
  return await invoke<boolean>("es_admin");
}

/**
 * Programa la reversion del pase en el backend Rust.
 * NO puede vivir en el frontend: si se cierra la ventana, el bloqueo
 * tiene que volver igual.
 */
export async function programarPase(
  minutos: number,
  dominios: string[]
): Promise<void> {
  await invoke("programar_pase", { minutos, dominios });
}

export async function cancelarPase(): Promise<void> {
  await invoke("cancelar_pase");
}
