import { useState } from "react";
import type { Store, Task, Step } from "../types";
import { uid } from "../types";

type Props = { store: Store; setStore: (s: Store) => void; volver: () => void };

/**
 * Unico lugar del sistema con friccion deliberada (3.3):
 * no se crea una tarea sin al menos un paso concreto.
 */
export default function Triage({ store, setStore, volver }: Props) {
  const [crudo, setCrudo] = useState("");
  const [pasos, setPasos] = useState<Step[]>([]);
  const [borrador, setBorrador] = useState("");
  const [size, setSize] = useState<1 | 2 | 3>(1);
  // `size` es el tamano del paso que se esta escribiendo, no de la tarea.
  const [deadline, setDeadline] = useState("");
  const item = store.inbox[0];

  function limpiar() {
    setPasos([]);
    setBorrador("");
    setDeadline("");
    setSize(1);
  }

  function capturar() {
    if (!crudo.trim()) return;
    setStore({
      ...store,
      inbox: [
        ...store.inbox,
        { id: uid(), raw: crudo.trim(), capturedAt: new Date().toISOString() },
      ],
    });
    setCrudo("");
  }

  function agregarPaso() {
    if (!borrador.trim()) return;
    setPasos([...pasos, { id: uid(), text: borrador.trim(), done: false, size }]);
    setBorrador("");
    setSize(1);
  }

  function convertir() {
    // Si quedo texto en el campo sin confirmar, se toma igual.
    const todos: Step[] = borrador.trim()
      ? [...pasos, { id: uid(), text: borrador.trim(), done: false, size }]
      : pasos;
    if (todos.length === 0) return;

    const t: Task = {
      id: uid(),
      title: item.raw,
      steps: todos,
      deadline: deadline || undefined,
      createdAt: new Date().toISOString(),
      rejectCount: 0,
      status: "ready",
    };
    setStore({
      ...store,
      inbox: store.inbox.slice(1),
      tasks: [...store.tasks, t],
    });
    limpiar();
  }

  function descartar() {
    setStore({ ...store, inbox: store.inbox.slice(1) });
    limpiar();
  }

  function posponer() {
    setStore({ ...store, inbox: [...store.inbox.slice(1), store.inbox[0]] });
    limpiar();
  }

  const listo = pasos.length > 0 || borrador.trim().length > 0;

  return (
    <div className="absolute inset-0 overflow-y-auto px-10 pt-8 pb-24">
      <div className="max-w-2xl mx-auto">
        <button onClick={volver} className="btn-texto mb-8">
          &larr; volver
        </button>

        <div className="flex gap-2 mb-8">
          <input
            value={crudo}
            onChange={(e) => setCrudo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && capturar()}
            placeholder="anotar algo, sin pensarlo"
            className="input flex-1"
          />
          <button onClick={capturar} className="btn-secundario">
            anotar
          </button>
        </div>

        {!item ? (
          <p style={{ color: "var(--suave)" }}>Nada por ordenar.</p>
        ) : (
          <div>
            <p
              className="text-xs uppercase tracking-widest mb-2"
              style={{ color: "var(--suave)" }}
            >
              {store.inbox.length} sin ordenar
            </p>
            <p className="text-2xl mb-6">{item.raw}</p>

            <label className="block text-base mb-1">Pasos, en orden</label>
            <p className="text-sm mb-3" style={{ color: "var(--suave)" }}>
              Acciones concretas. El primero tiene que poder hacerse en menos de
              5 minutos. Enter agrega otro.
            </p>

            {pasos.length > 0 && (
              <div className="mb-3 space-y-1">
                {pasos.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 text-sm">
                    <span
                      className="tabular-nums w-4 shrink-0"
                      style={{ color: "var(--suave)" }}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1">{s.text}</span>
                    <span style={{ color: "var(--suave)" }}>
                      {["5 min", "20 min", "1 h"][s.size - 1]}
                    </span>
                    <button
                      onClick={() => setPasos(pasos.filter((x) => x.id !== s.id))}
                      className="btn-texto"
                    >
                      quitar
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 mb-6">
              <input
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && agregarPaso()}
                placeholder={
                  pasos.length === 0
                    ? "abrir el PDF y leer dos páginas"
                    : "siguiente paso"
                }
                className="input flex-1"
                autoFocus
              />
              <button
                onClick={agregarPaso}
                disabled={!borrador.trim()}
                className="btn-secundario disabled:opacity-30"
              >
                +
              </button>
            </div>

            <div className="flex gap-10 mb-7">
              <div>
                <span
                  className="block text-sm mb-2"
                  style={{ color: "var(--suave)" }}
                >
                  Cuánto lleva este paso
                </span>
                <div className="flex gap-1">
                  {([1, 2, 3] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className="px-4 py-2 text-sm border"
                      style={{
                        borderColor: size === s ? "var(--tinta)" : "var(--linea)",
                        background: size === s ? "var(--tinta)" : "transparent",
                        color: size === s ? "var(--papel)" : "var(--tinta)",
                      }}
                    >
                      {["5 min", "20 min", "1 h"][s - 1]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span
                  className="block text-sm mb-2"
                  style={{ color: "var(--suave)" }}
                >
                  Fecha límite (opcional)
                </span>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            {/* Fijas abajo: con varios pasos cargados se iban del pliegue. */}
            <div
              className="sticky bottom-0 flex gap-3 items-center py-4"
              style={{ background: "var(--papel)" }}
            >
              <button
                onClick={convertir}
                disabled={!listo}
                className="btn-primario disabled:opacity-30"
              >
                agregar
              </button>
              <button onClick={posponer} className="btn-secundario">
                después
              </button>
              <button onClick={descartar} className="btn-texto">
                descartar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
