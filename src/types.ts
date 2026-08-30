export type InboxItem = {
  id: string;
  raw: string;
  capturedAt: string;
};

export type Step = {
  id: string;
  text: string;
  done: boolean;
  /** Cuanto lleva ESTE paso. 1 = 5 min, 2 = 20 min, 3 = 1 h. */
  size: 1 | 2 | 3;
};

export type Task = {
  id: string;
  /** El contenedor: de qué se trata. Viene del texto crudo del inbox. */
  title: string;
  /**
   * Los pasos, en orden. Cada uno es una accion concreta.
   * La pantalla principal muestra el primero sin hacer.
   */
  steps: Step[];
  /** Campos viejos, solo para migrar stores de versiones anteriores. */
  move?: string;
  size?: 1 | 2 | 3;
  project?: string;
  deadline?: string;
  createdAt: string;
  lastProposedAt?: string;
  lastRejectedAt?: string;
  rejectCount: number;
  completedAt?: string;
  archivedAt?: string;
  status: "ready" | "done" | "archived";
};

/** Primer paso sin hacer. null si ya estan todos. */
export function pasoActual(t: Task): Step | null {
  return t.steps.find((s) => !s.done) ?? null;
}

export function progreso(t: Task): { hechos: number; total: number } {
  return { hechos: t.steps.filter((s) => s.done).length, total: t.steps.length };
}

/**
 * Migracion desde la version con un solo `move`.
 * Se ejecuta al cargar el store; es idempotente.
 */
export function migrarTarea(t: any): Task {
  const texto: string = t.move ?? t.title ?? "(sin texto)";
  const heredado: 1 | 2 | 3 = t.size ?? 1;
  const steps =
    Array.isArray(t.steps) && t.steps.length > 0
      ? t.steps.map((s: any, i: number) => ({
          ...s,
          // El tamano paso de la tarea a cada paso. El primero hereda el
          // valor viejo; los demas arrancan en 5 min.
          size: s.size ?? (i === 0 ? heredado : 1),
        }))
      : [{ id: uid(), text: texto, done: t.status === "done", size: heredado }];
  return { ...t, title: t.title ?? texto, steps } as Task;
}

export type BlockList = {
  id: string;
  name: string;
  domains: string[];
};

export type LockState =
  | { kind: "off" }
  | { kind: "armed"; listId: string }
  | { kind: "pass"; listId: string; until: string };

export type PassLedger = {
  weekStart: string;
  used: number;
};

export type DayRecord = {
  date: string;
  completed: number;
  note?: string;
};

export type Store = {
  version: 1;
  inbox: InboxItem[];
  tasks: Task[];
  lists: BlockList[];
  lock: LockState;
  passes: PassLedger;
  days: DayRecord[];
};

export const STORE_VACIO: Store = {
  version: 1,
  inbox: [],
  tasks: [],
  lists: [
    {
      id: "default",
      name: "Distraccion",
      domains: ["tiktok.com", "instagram.com", "x.com", "youtube.com"],
    },
  ],
  lock: { kind: "off" },
  passes: { weekStart: lunesDe(new Date()), used: 0 },
  days: [],
};

export function lunesDe(d: Date): string {
  const x = new Date(d);
  const dia = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dia);
  return x.toISOString().slice(0, 10);
}

export function hoy(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
