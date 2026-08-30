import { useState, useEffect } from "react";
import type { Store } from "../types";
import { lunesDe } from "../types";
import * as api from "../api";

type Props = { store: Store; setStore: (s: Store) => void; volver: () => void };

const CUPO_SEMANAL = 3;
const DEMORA_PASE_SEG = 20;

export default function Bloqueo({ store, setStore, volver }: Props) {
  const lista = store.lists.find((l) => l.id === "default")!;
  const [texto, setTexto] = useState(lista.domains.join("\n"));
  const [error, setError] = useState<string | null>(null);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [cuenta, setCuenta] = useState<number | null>(null);
  const [minutos, setMinutos] = useState(30);
  const [confirmar, setConfirmar] = useState("");

  useEffect(() => {
    api.esAdmin().then(setAdmin);
  }, []);

  useEffect(() => {
    if (cuenta === null) return;
    if (cuenta <= 0) {
      aplicarPase();
      return;
    }
    const id = setTimeout(() => setCuenta(cuenta - 1), 1000);
    return () => clearTimeout(id);
  }, [cuenta]);

  const semana = lunesDe(new Date());
  const usados = store.passes.weekStart === semana ? store.passes.used : 0;
  const restantes = CUPO_SEMANAL - usados;
  const activo = store.lock.kind !== "off";

  const dominios = () =>
    texto.split("\n").map((d) => d.trim()).filter(Boolean);

  async function activar() {
    setError(null);
    try {
      const ds = dominios();
      await api.aplicarBloqueo(ds);
      setStore({
        ...store,
        lists: [{ ...lista, domains: ds }],
        lock: { kind: "armed", listId: "default" },
      });
    } catch (e) {
      setError(traducir(e));
    }
  }

  async function desactivar() {
    setError(null);
    try {
      await api.quitarBloqueo();
      setStore({ ...store, lock: { kind: "off" } });
    } catch (e) {
      setError(traducir(e));
    }
  }

  async function aplicarPase() {
    setCuenta(null);
    setError(null);
    try {
      await api.programarPase(minutos, dominios());
      setStore({
        ...store,
        lock: {
          kind: "pass",
          listId: "default",
          until: new Date(Date.now() + minutos * 60000).toISOString(),
        },
        passes: { weekStart: semana, used: usados + 1 },
      });
    } catch (e) {
      setError(traducir(e));
    }
  }

  async function salidaDefinitiva() {
    setError(null);
    try {
      await api.quitarBloqueo();
      setStore({
        ...store,
        lists: [{ id: "default", name: "Distraccion", domains: [] }],
        lock: { kind: "off" },
      });
      setTexto("");
      setConfirmar("");
    } catch (e) {
      setError(traducir(e));
    }
  }

  return (
    <div className="absolute inset-0 overflow-y-auto px-10 pt-8 pb-24">
      <div className="max-w-2xl mx-auto">
        <button onClick={volver} className="btn-texto mb-8">
          &larr; volver
        </button>

        {admin === false && (
          <div
            className="p-4 mb-8 text-sm border"
            style={{ borderColor: "var(--linea)" }}
          >
            La aplicación no se está ejecutando como administrador. El bloqueo
            va a fallar. Cerrala y volvé a abrirla con «Ejecutar como
            administrador».
          </div>
        )}

        {/* ---- Sitios ---- */}
        <h2 className="text-xl mb-1">Sitios bloqueados</h2>
        <p className="text-sm mb-3" style={{ color: "var(--suave)" }}>
          Uno por línea, sin http. Se bloquea el dominio y su www, en todos
          los navegadores.
        </p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={6}
          className="input w-full font-mono text-sm mb-2"
          disabled={activo}
        />

        {/* ---- Interruptor ---- */}
        <div className="flex items-center gap-3 mt-6 mb-10">
          {!activo ? (
            <button onClick={activar} className="btn-primario">
              activar bloqueo
            </button>
          ) : (
            <button onClick={desactivar} className="btn-secundario">
              desactivar
            </button>
          )}
          {store.lock.kind === "pass" && (
            <span className="text-sm" style={{ color: "var(--suave)" }}>
              pase activo hasta{" "}
              {new Date(store.lock.until).toLocaleTimeString("es", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        {error && (
          <p className="text-sm mb-8 border-l-2 pl-3">{error}</p>
        )}

        {/* ---- Salida A ---- */}
        <h2 className="text-xl mb-1">Pase temporal</h2>
        <p className="text-sm mb-4" style={{ color: "var(--suave)" }}>
          Te quedan {restantes} de {CUPO_SEMANAL} esta semana. Vuelve solo al
          vencer.
        </p>
        {cuenta === null ? (
          <div className="flex items-center gap-2 mb-12">
            <select
              value={minutos}
              onChange={(e) => setMinutos(Number(e.target.value))}
              className="input"
            >
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
            </select>
            <button
              onClick={() => setCuenta(DEMORA_PASE_SEG)}
              disabled={restantes <= 0 || store.lock.kind !== "armed"}
              className="btn-secundario disabled:opacity-30"
            >
              usar un pase
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 mb-12">
            <span className="text-2xl tabular-nums">{cuenta}</span>
            <button onClick={() => setCuenta(null)} className="btn-secundario">
              cancelar
            </button>
          </div>
        )}

        {/* ---- Salida B ---- */}
        <h2 className="text-xl mb-1">Salida definitiva</h2>
        <p className="text-sm mb-4" style={{ color: "var(--suave)" }}>
          Borra la lista de sitios y desactiva el bloqueo. Las tareas quedan
          intactas. Para volver hay que cargar todo de nuevo.
          Escribí BORRAR.
        </p>
        <div className="flex gap-2">
          <input
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            className="input"
            placeholder="BORRAR"
          />
          <button
            onClick={salidaDefinitiva}
            disabled={confirmar !== "BORRAR"}
            className="btn-secundario disabled:opacity-30"
          >
            confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function traducir(e: unknown): string {
  const s = typeof e === "string" ? e : JSON.stringify(e);
  if (s.includes("SinPermisos"))
    return "Sin permisos. Reabrí la aplicación como administrador.";
  if (s.includes("ArchivoBloqueado"))
    return "El archivo hosts está en uso (antivirus). Probá de nuevo en unos segundos.";
  return "No se pudo escribir el archivo hosts: " + s;
}
