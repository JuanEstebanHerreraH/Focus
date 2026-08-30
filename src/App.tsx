import { useEffect, useState, useRef } from "react";
import type { Store } from "./types";
import { STORE_VACIO, lunesDe, migrarTarea } from "./types";
import { archivarVencidas, diasActivos30 } from "./engine";
import * as api from "./api";
import Principal from "./screens/Principal";
import Triage from "./screens/Triage";
import Bloqueo from "./screens/Bloqueo";
import Todas from "./screens/Todas";

type Pantalla = "principal" | "triage" | "bloqueo" | "todas";
type Tema = "claro" | "oscuro";

export default function App() {
  const [store, setStore] = useState<Store | null>(null);
  const [pantalla, setPantalla] = useState<Pantalla>("principal");
  const [tema, setTema] = useState<Tema>(() => {
    const guardado = localStorage.getItem("tema") as Tema | null;
    if (guardado === "claro" || guardado === "oscuro") return guardado;
    // Primera vez: se toma la preferencia del sistema y despues es manual.
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "oscuro"
      : "claro";
  });
  const primeraCarga = useRef(true);

  useEffect(() => {
    const r = document.documentElement;
    r.classList.remove("claro", "oscuro");
    r.classList.add(tema);
    localStorage.setItem("tema", tema);
  }, [tema]);

  // Arranque: cargar, archivar en silencio, reconciliar el candado.
  useEffect(() => {
    (async () => {
      let s: Store;
      try {
        s = await api.cargarStore();
      } catch {
        s = STORE_VACIO;
      }

      const now = new Date();
      // Migracion desde la version con un solo `move` por tarea.
      s = { ...s, tasks: s.tasks.map(migrarTarea) };
      s = { ...s, tasks: archivarVencidas(s.tasks, now) };

      const semana = lunesDe(now);
      if (s.passes.weekStart !== semana) {
        s = { ...s, passes: { weekStart: semana, used: 0 } };
      }

      // Reconciliacion (5.4). Sin esto, un cierre inesperado deja el sistema
      // bloqueado sin forma de desbloquearlo desde la aplicacion.
      try {
        const presente = await api.bloqueoPresente();
        if (s.lock.kind === "armed" && !presente) {
          s = { ...s, lock: { kind: "off" } };
        } else if (s.lock.kind === "off" && presente) {
          await api.quitarBloqueo();
        } else if (s.lock.kind === "pass") {
          const listId = s.lock.listId;
          const lista = s.lists.find((l) => l.id === listId);
          if (new Date(s.lock.until) <= now) {
            if (lista) await api.aplicarBloqueo(lista.domains);
            s = { ...s, lock: { kind: "armed", listId } };
          } else if (lista) {
            const restanteMin = Math.max(
              1,
              Math.ceil((new Date(s.lock.until).getTime() - now.getTime()) / 60000)
            );
            await api.programarPase(restanteMin, lista.domains);
          }
        }
      } catch {
        /* sin permisos: se avisa en la pantalla de bloqueo */
      }

      setStore(s);
      if (s.inbox.length > 5) setPantalla("triage");
    })();
  }, []);

  useEffect(() => {
    if (!store) return;
    if (primeraCarga.current) {
      primeraCarga.current = false;
      return;
    }
    api.guardarStore(store).catch(() => {});
  }, [store]);

  if (!store) return null;

  const props = {
    store,
    setStore,
    volver: () => setPantalla("principal"),
  };
  const activas = store.tasks.filter((t) => t.status === "ready").length;
  const dias = diasActivos30(store.days, new Date());

  return (
    <div className="absolute inset-0">
      {pantalla === "principal" && (
        <Principal
          store={store}
          setStore={setStore}
          abrirTriage={() => setPantalla("triage")}
        />
      )}
      {pantalla === "triage" && <Triage {...props} />}
      {pantalla === "bloqueo" && <Bloqueo {...props} />}
      {pantalla === "todas" && <Todas {...props} />}

      {/* Barra fija. Legible, no escondida.
          Sigue sin mostrar tareas: son accesos, no una lista. */}
      <nav
        className="absolute bottom-0 left-0 right-0 flex items-center gap-1 px-4 py-2 border-t"
        style={{ borderColor: "var(--linea)", background: "var(--papel)" }}
      >
        <button
          onClick={() => setPantalla("principal")}
          className="btn-nav"
          style={pantalla === "principal" ? { color: "var(--tinta)" } : undefined}
        >
          ahora
        </button>
        <button
          onClick={() => setPantalla("triage")}
          className="btn-nav"
          style={pantalla === "triage" ? { color: "var(--tinta)" } : undefined}
        >
          agregar{store.inbox.length > 0 ? ` (${store.inbox.length})` : ""}
        </button>
        <button
          onClick={() => setPantalla("todas")}
          className="btn-nav"
          style={pantalla === "todas" ? { color: "var(--tinta)" } : undefined}
        >
          todas ({activas})
        </button>
        <button
          onClick={() => setPantalla("bloqueo")}
          className="btn-nav"
          style={pantalla === "bloqueo" ? { color: "var(--tinta)" } : undefined}
        >
          bloqueo{store.lock.kind !== "off" ? " ●" : ""}
        </button>

        <span className="flex-1" />

        <span className="text-xs px-2" style={{ color: "var(--suave)" }}>
          {dias}/30 días
        </span>
        <button
          onClick={() => setTema(tema === "oscuro" ? "claro" : "oscuro")}
          className="btn-nav"
          title={tema === "oscuro" ? "pasar a claro" : "pasar a oscuro"}
        >
          {tema === "oscuro" ? "☀" : "☾"}
        </button>
      </nav>
    </div>
  );
}
