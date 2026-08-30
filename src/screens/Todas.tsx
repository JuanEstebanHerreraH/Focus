import { useState } from "react";
import type { Store, Task } from "../types";
import { uid, progreso } from "../types";
import { score } from "../engine";

type Props = { store: Store; setStore: (s: Store) => void; volver: () => void };
type Filtro = "activas" | "hechas" | "archivadas";

/**
 * Pantalla de confianza: verificar lo que cargaste, corregirlo, borrarlo.
 * No existe para elegir; por eso no esta en la principal.
 */
export default function Todas({ store, setStore, volver }: Props) {
  const [filtro, setFiltro] = useState<Filtro>("activas");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [nuevoPaso, setNuevoPaso] = useState("");

  const now = new Date();
  const estados: Record<Filtro, Task["status"]> = {
    activas: "ready",
    hechas: "done",
    archivadas: "archived",
  };

  const lista = store.tasks
    .filter((t) => t.status === estados[filtro])
    .sort((a, b) =>
      filtro === "activas"
        ? score(b, now) - score(a, now)
        : (b.completedAt ?? b.archivedAt ?? "").localeCompare(
            a.completedAt ?? a.archivedAt ?? ""
          )
    );

  function actualizar(id: string, cambios: Partial<Task>) {
    setStore({
      ...store,
      tasks: store.tasks.map((t) => (t.id === id ? { ...t, ...cambios } : t)),
    });
  }

  function togglePaso(t: Task, stepId: string) {
    const steps = t.steps.map((s) =>
      s.id === stepId ? { ...s, done: !s.done } : s
    );
    const todos = steps.every((s) => s.done);
    actualizar(t.id, {
      steps,
      status: todos ? "done" : "ready",
      completedAt: todos ? new Date().toISOString() : undefined,
    });
  }

  function agregarPaso(t: Task) {
    if (!nuevoPaso.trim()) return;
    actualizar(t.id, {
      steps: [...t.steps, { id: uid(), text: nuevoPaso.trim(), done: false, size: 1 }],
      status: "ready",
      completedAt: undefined,
    });
    setNuevoPaso("");
  }

  const activas = store.tasks.filter((t) => t.status === "ready").length;

  return (
    <div className="absolute inset-0 overflow-y-auto px-10 pt-8 pb-24">
      <div className="max-w-2xl mx-auto">
        <button onClick={volver} className="btn-texto mb-8">
          &larr; volver
        </button>

        <div className="flex gap-1 mb-2">
          {(["activas", "hechas", "archivadas"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className="px-3 py-1.5 text-sm border"
              style={{
                borderColor: filtro === f ? "var(--tinta)" : "var(--linea)",
                background: filtro === f ? "var(--tinta)" : "transparent",
                color: filtro === f ? "var(--papel)" : "var(--suave)",
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <p className="text-sm mb-8" style={{ color: "var(--suave)" }}>
          {activas} activas · ordenadas por lo que el motor elegiría primero
        </p>

        {lista.length === 0 && <p style={{ color: "var(--suave)" }}>Nada acá.</p>}

        <div className="space-y-1">
          {lista.map((t) => {
            const { hechos, total } = progreso(t);
            const open = abierta === t.id;
            return (
              <div
                key={t.id}
                className="border-b py-3"
                style={{ borderColor: "var(--linea)" }}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setAbierta(open ? null : t.id)}
                    className="flex-1 text-left"
                  >
                    <div
                      style={{
                        color: t.status === "ready" ? "var(--tinta)" : "var(--suave)",
                        textDecoration:
                          t.status === "done" ? "line-through" : "none",
                      }}
                    >
                      {t.title}
                    </div>
                    <div
                      className="flex gap-3 text-xs mt-1"
                      style={{ color: "var(--suave)" }}
                    >
                      <span>
                        {hechos}/{total} pasos
                      </span>
                      <span>
                        {t.steps
                          .filter((s) => !s.done)
                          .reduce((a, s) => a + [5, 20, 60][s.size - 1], 0)}{" "}
                        min restantes
                      </span>
                      {t.deadline && <span>vence {t.deadline}</span>}
                      {t.status === "ready" && (
                        <span>puntaje {score(t, now).toFixed(1)}</span>
                      )}
                      <span>{open ? "▴" : "▾"}</span>
                    </div>
                  </button>

                  <div className="flex gap-2 shrink-0">
                    {t.status !== "ready" && (
                      <button
                        onClick={() =>
                          actualizar(t.id, {
                            status: "ready",
                            archivedAt: undefined,
                            completedAt: undefined,
                            lastProposedAt: undefined,
                            rejectCount: 0,
                            steps: t.steps.map((s) => ({ ...s, done: false })),
                          })
                        }
                        className="btn-texto"
                      >
                        reactivar
                      </button>
                    )}
                    <button
                      onClick={() =>
                        setStore({
                          ...store,
                          tasks: store.tasks.filter((x) => x.id !== t.id),
                        })
                      }
                      className="btn-texto"
                    >
                      borrar
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="mt-3 pl-1 space-y-1.5">
                    {t.steps.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-3 text-sm">
                        <button
                          onClick={() => togglePaso(t, s.id)}
                          className="w-4 h-4 shrink-0 border flex items-center justify-center text-[10px]"
                          style={{
                            borderColor: "var(--linea)",
                            background: s.done ? "var(--tinta)" : "transparent",
                            color: "var(--papel)",
                          }}
                        >
                          {s.done ? "✓" : ""}
                        </button>
                        {editando === s.id ? (
                          <input
                            value={texto}
                            onChange={(e) => setTexto(e.target.value)}
                            onBlur={() => {
                              if (texto.trim())
                                actualizar(t.id, {
                                  steps: t.steps.map((x) =>
                                    x.id === s.id ? { ...x, text: texto.trim() } : x
                                  ),
                                });
                              setEditando(null);
                            }}
                            onKeyDown={(e) =>
                              e.key === "Enter" && e.currentTarget.blur()
                            }
                            className="input flex-1 py-1"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setEditando(s.id);
                              setTexto(s.text);
                            }}
                            className="flex-1 text-left"
                            style={{
                              color: s.done ? "var(--suave)" : "var(--tinta)",
                              textDecoration: s.done ? "line-through" : "none",
                            }}
                          >
                            {s.text}
                          </button>
                        )}
                        <button
                          onClick={() =>
                            actualizar(t.id, {
                              steps: t.steps.map((x) =>
                                x.id === s.id
                                  ? { ...x, size: ((x.size % 3) + 1) as 1 | 2 | 3 }
                                  : x
                              ),
                            })
                          }
                          className="btn-texto tabular-nums shrink-0"
                          title="cambiar duración"
                        >
                          {["5 min", "20 min", "1 h"][s.size - 1]}
                        </button>
                        <button
                          onClick={() =>
                            actualizar(t.id, {
                              steps: t.steps.filter((x) => x.id !== s.id),
                            })
                          }
                          className="btn-texto"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    <div className="flex gap-2 pt-1">
                      <input
                        value={abierta === t.id ? nuevoPaso : ""}
                        onChange={(e) => setNuevoPaso(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && agregarPaso(t)}
                        placeholder="agregar paso"
                        className="input flex-1 py-1 text-sm"
                      />
                      <button
                        onClick={() => agregarPaso(t)}
                        disabled={!nuevoPaso.trim()}
                        className="btn-secundario disabled:opacity-30 py-1 px-3 text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
