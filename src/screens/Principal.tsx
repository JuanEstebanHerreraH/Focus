import { useState, useEffect } from "react";
import type { Store, Task } from "../types";
import { hoy, pasoActual, progreso } from "../types";
import { pickNext, pickMinima } from "../engine";

type Props = {
  store: Store;
  setStore: (s: Store) => void;
  abrirTriage: () => void;
};

/**
 * REGLA (7.1): UNA tarea. Se muestran los pasos de esa tarea porque su
 * orden ya esta decidido y no obligan a elegir. Lo que no puede aparecer
 * aca es una lista de tareas distintas: ahi vuelve el problema.
 */
export default function Principal({ store, setStore, abrirTriage }: Props) {
  const [rechazados, setRechazados] = useState<string[]>([]);
  const [minima, setMinima] = useState(false);
  const [agotado, setAgotado] = useState(false);
  const [actual, setActual] = useState<Task | null>(null);

  useEffect(() => {
    const now = new Date();
    setActual(
      minima
        ? pickMinima(store.tasks, now, rechazados)
        : pickNext(store.tasks, now, rechazados)
    );
  }, [store.tasks, rechazados, minima]);

  function completarPaso(t: Task) {
    const paso = pasoActual(t);
    if (!paso) return;
    const iso = new Date().toISOString();
    const steps = t.steps.map((s) => (s.id === paso.id ? { ...s, done: true } : s));
    const terminada = steps.every((s) => s.done);

    // El dia solo cuenta como activo cuando se completa un paso.
    const d = hoy();
    const dias = [...store.days];
    const i = dias.findIndex((x) => x.date === d);
    if (i >= 0) dias[i] = { ...dias[i], completed: dias[i].completed + 1 };
    else dias.push({ date: d, completed: 1 });

    setStore({
      ...store,
      days: dias,
      tasks: store.tasks.map((x) =>
        x.id === t.id
          ? {
              ...x,
              steps,
              lastProposedAt: iso,
              rejectCount: 0,
              ...(terminada
                ? { status: "done" as const, completedAt: iso }
                : {}),
            }
          : x
      ),
    });
    setRechazados([]);
    setMinima(false);
  }

  function rechazar(t: Task) {
    const iso = new Date().toISOString();
    const nuevos = [...rechazados, t.id];
    setStore({
      ...store,
      tasks: store.tasks.map((x) =>
        x.id === t.id
          ? {
              ...x,
              lastProposedAt: iso,
              lastRejectedAt: iso,
              rejectCount: x.rejectCount + 1,
            }
          : x
      ),
    });
    if (minima) setAgotado(true);
    else if (nuevos.length >= 3) {
      setMinima(true);
      setRechazados(nuevos);
    } else setRechazados(nuevos);
  }

  if (agotado) {
    return (
      <Centro>
        <p className="text-xl" style={{ color: "var(--suave)" }}>
          Hoy no. Nos vemos cuando quieras.
        </p>
      </Centro>
    );
  }

  if (!actual) {
    const hayInbox = store.inbox.length > 0;
    return (
      <Centro>
        <p className="text-xl mb-8" style={{ color: "var(--suave)" }}>
          {hayInbox ? "Hay cosas sin ordenar." : "Nada pendiente."}
        </p>
        <button onClick={abrirTriage} className="btn-primario">
          {hayInbox ? "Ordenar" : "Agregar algo"}
        </button>
      </Centro>
    );
  }

  const paso = pasoActual(actual)!;
  const { hechos, total } = progreso(actual);
  const restantes = actual.steps.filter((s) => !s.done && s.id !== paso.id);
  const hechas = actual.steps.filter((s) => s.done);

  return (
    <Centro>
      {minima && (
        <p
          className="text-xs tracking-widest uppercase mb-5"
          style={{ color: "var(--suave)" }}
        >
          Solo esto y listo
        </p>
      )}

      {/* Contenedor: de que se trata */}
      <p className="text-sm mb-3" style={{ color: "var(--suave)" }}>
        {actual.title}
        {total > 1 && ` · paso ${hechos + 1} de ${total}`}
      </p>

      {/* El paso actual. Es lo unico que hay que decidir. */}
      <h1 className="text-5xl leading-[1.15] font-medium max-w-3xl mb-10 text-balance">
        {paso.text}
      </h1>

      {/* Los que siguen: visibles, apagados, no accionables. */}
      {(restantes.length > 0 || hechas.length > 0) && (
        <div className="mb-10 space-y-1 max-w-xl">
          {hechas.slice(-2).map((s) => (
            <p
              key={s.id}
              className="text-sm line-through"
              style={{ color: "var(--suave)", opacity: 0.5 }}
            >
              {s.text}
            </p>
          ))}
          {restantes.map((s) => (
            <p key={s.id} className="text-sm" style={{ color: "var(--suave)" }}>
              {s.text}
            </p>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => completarPaso(actual)} className="btn-primario">
          {restantes.length > 0 ? "hecho, sigo" : "dale"}
        </button>
        <button onClick={() => rechazar(actual)} className="btn-secundario">
          otra
        </button>
      </div>
    </Centro>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center px-12 text-center"
      style={{ paddingBottom: "4rem" }}
    >
      {children}
    </div>
  );
}
