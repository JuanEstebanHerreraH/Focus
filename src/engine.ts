import type { Task, DayRecord } from "./types";
import { pasoActual } from "./types";

// ---------------------------------------------------------------------------
// Pesos del motor. Son una conjetura razonable, no un resultado.
// Punto abierto 11.1 del documento de arquitectura.
// ---------------------------------------------------------------------------
export const Wu = 4.0; // urgencia
export const Wt = 2.0; // facilidad
export const Wf = 1.0; // frescura
export const Wr = 3.0; // penalizacion por rechazo

export const LIMITE_DIAS_ARCHIVO = 21;

const DIA_MS = 86_400_000;
const HORA_MS = 3_600_000;

export function urgencia(t: Task, now: Date): number {
  if (!t.deadline) return 0.2;
  const dias = (new Date(t.deadline).getTime() - now.getTime()) / DIA_MS;
  if (dias <= 0) return 1.0;
  if (dias >= 14) return 0.1;
  return 1 - dias / 14;
}

/**
 * Lo que importa para arrancar es cuanto cuesta el PROXIMO paso,
 * no la tarea entera. Por eso se mide sobre el paso actual.
 */
export function facilidad(t: Task): number {
  const paso = pasoActual(t);
  const size = paso?.size ?? 1;
  return { 1: 1.0, 2: 0.6, 3: 0.3 }[size];
}

/** Candidata: activa, no archivada y con al menos un paso pendiente. */
export function esCandidata(t: Task): boolean {
  return t.status === "ready" && !t.archivedAt && pasoActual(t) !== null;
}

export function frescura(t: Task, now: Date): number {
  if (!t.lastProposedAt) return 1.0;
  const horas = (now.getTime() - new Date(t.lastProposedAt).getTime()) / HORA_MS;
  return Math.min(horas / 24, 1.0);
}

export function rechazo(t: Task, now: Date): number {
  if (!t.lastRejectedAt) return 0;
  const mismoDia =
    t.lastRejectedAt.slice(0, 10) === now.toISOString().slice(0, 10);
  if (!mismoDia) return 0;
  return Math.min(t.rejectCount / 3, 1.0);
}

export function score(t: Task, now: Date): number {
  return (
    Wu * urgencia(t, now) +
    Wt * facilidad(t) +
    Wf * frescura(t, now) -
    Wr * rechazo(t, now)
  );
}

/**
 * Devuelve UNA tarea o null. Nunca una lista.
 * `excluir` son los ids ya rechazados en esta sesion.
 */
export function pickNext(
  tasks: Task[],
  now: Date,
  excluir: string[] = []
): Task | null {
  const candidatas = tasks.filter(
    (t) => esCandidata(t) && !excluir.includes(t.id)
  );
  if (candidatas.length === 0) return null;
  return candidatas.reduce((mejor, t) =>
    score(t, now) > score(mejor, now) ? t : mejor
  );
}

/** Modo minimo: la tarea de tamano 1 con mayor puntaje. */
export function pickMinima(
  tasks: Task[],
  now: Date,
  excluir: string[] = []
): Task | null {
  const chicas = tasks.filter(
    (t) => esCandidata(t) && (pasoActual(t)?.size ?? 1) === 1 && !excluir.includes(t.id)
  );
  if (chicas.length === 0) return pickNext(tasks, now, excluir);
  return chicas.reduce((mejor, t) =>
    score(t, now) > score(mejor, now) ? t : mejor
  );
}

/**
 * Archivado automatico. Corre al arrancar, EN SILENCIO.
 * Es lo que permite volver despues de tres semanas a una pantalla limpia.
 */
export function archivarVencidas(tasks: Task[], now: Date): Task[] {
  return tasks.map((t) => {
    if (t.status !== "ready") return t;
    const ref = new Date(t.lastProposedAt ?? t.createdAt);
    const dias = (now.getTime() - ref.getTime()) / DIA_MS;
    if (dias < LIMITE_DIAS_ARCHIVO) return t;
    return { ...t, status: "archived" as const, archivedAt: now.toISOString() };
  });
}

/** Unica metrica visible. Se recupera sola. No existe el cero absoluto. */
export function diasActivos30(days: DayRecord[], now: Date): number {
  const corte = new Date(now.getTime() - 30 * DIA_MS);
  return days.filter((d) => new Date(d.date) >= corte && d.completed > 0).length;
}
