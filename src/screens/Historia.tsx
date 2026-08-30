import { useState } from "react";
import type { Store } from "../types";
import { hoy } from "../types";
import { diasActivos30 } from "../engine";

type Props = { store: Store; setStore: (s: Store) => void; volver: () => void };

export default function Historia({ store, setStore, volver }: Props) {
  const d = hoy();
  const registroHoy = store.days.find((x) => x.date === d);
  const [nota, setNota] = useState(registroHoy?.note ?? "");
  const [verArchivo, setVerArchivo] = useState(false);

  function guardarNota() {
    const dias = [...store.days];
    const i = dias.findIndex((x) => x.date === d);
    if (i >= 0) dias[i] = { ...dias[i], note: nota };
    else dias.push({ date: d, completed: 0, note: nota });
    setStore({ ...store, days: dias });
  }

  const archivadas = store.tasks.filter((t) => t.status === "archived");

  return (
    <div className="h-full overflow-y-auto px-10 py-8 max-w-2xl mx-auto w-full">
      <button onClick={volver} className="text-sm text-[var(--color-suave)] mb-10">
        &larr; volver
      </button>

      {/* Unica metrica. Sin grafico, sin comparacion, sin objetivo. */}
      <div className="mb-12">
        <div className="text-6xl tabular-nums leading-none">
          {diasActivos30(store.days, new Date())}
        </div>
        <div className="text-sm text-[var(--color-suave)] mt-2">
          días activos en los últimos 30
        </div>
      </div>

      <label className="block text-sm mb-2">Cómo estuvo hoy</label>
      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        onBlur={guardarNota}
        placeholder="una línea"
        className="input w-full mb-12"
      />

      <div className="space-y-3 mb-12">
        {[...store.days]
          .filter((x) => x.note)
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 30)
          .map((x) => (
            <div key={x.date} className="flex gap-4 text-sm">
              <span className="text-[var(--color-suave)] tabular-nums shrink-0">
                {x.date.slice(5)}
              </span>
              <span>{x.note}</span>
            </div>
          ))}
      </div>

      <button
        onClick={() => setVerArchivo(!verArchivo)}
        className="text-sm text-[var(--color-suave)]"
      >
        {verArchivo ? "ocultar" : "ver"} archivadas ({archivadas.length})
      </button>
      {verArchivo && (
        <div className="mt-4 space-y-2 pb-10">
          {archivadas.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-suave)]">{t.move}</span>
              <button
                onClick={() =>
                  setStore({
                    ...store,
                    tasks: store.tasks.map((x) =>
                      x.id === t.id
                        ? { ...x, status: "ready" as const, archivedAt: undefined,
                            lastProposedAt: undefined, rejectCount: 0 }
                        : x
                    ),
                  })
                }
                className="btn-texto"
              >
                recuperar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
