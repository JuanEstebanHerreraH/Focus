<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="docs/logo-light.png">
    <img src="docs/logo-light.png" alt="Foco" width="110">
  </picture>
</p>

<h1 align="center">Foco</h1>

<p align="center">
  Aplicación de escritorio para Windows que responde una sola pregunta:<br>
  <strong>¿qué hago ahora?</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/estado-v1-black" alt="Estado">
  <img src="https://img.shields.io/badge/plataforma-Windows%2010%2F11-black" alt="Plataforma">
  <img src="https://img.shields.io/badge/licencia-MIT-black" alt="Licencia">
</p>

---

No es un gestor de tareas. Es lo contrario. Un gestor de tareas te muestra una lista y te deja la decisión; Foco toma la decisión por vos y te muestra una cosa sola.

## El problema

Las aplicaciones de productividad asumen que el problema es la memoria o la organización: si anotás todo y lo ordenás bien, vas a ejecutarlo. Para mucha gente el cuello de botella está en otro lado — no en recordar qué hay que hacer, sino en **elegir por dónde empezar**. Abrís la lista, ves nueve cosas, cerrás la lista.

Foco parte de una premisa distinta: cada opción visible es una decisión más que hay que tomar antes de trabajar, y las decisiones se agotan.

## Cómo funciona

**Una tarea a la vez, pantalla completa, dos botones.** No hay lista en la pantalla principal. Hay un motor de puntuación que pondera urgencia, facilidad de arranque, frescura y rechazos recientes, y propone una sola cosa. Aceptás o pedís otra.

**Ninguna tarea entra sin pasos concretos.** No podés guardar "estudiar tipografía". Podés guardar "abrir el PDF y leer dos páginas". La parálisis se resuelve en el momento tranquilo de la carga, no en el momento de fricción.

**Sin rachas.** La única métrica son los días activos en los últimos 30. Se recupera sola, no tiene evento de ruptura y no existe el cero. Un sistema que castiga el día perdido se abandona el día siguiente.

**Lo viejo se archiva solo, en silencio.** Si desaparecés dos semanas y volvés, la pantalla está limpia. No hay pantalla de "te perdiste 12 días", no hay backlog en rojo, no hay contabilidad de la ausencia. Volver es idéntico a un día normal. Este es probablemente el detalle más importante del diseño.

**Bloqueo de sitios a nivel sistema.** Escribe en el archivo `hosts` de Windows, así que funciona en todos los navegadores a la vez, no solo en uno.

**Dos salidas de emergencia, ambas sin castigo.** Un pase temporal de 30 a 60 minutos que se revierte solo (cupo de 3 por semana), y una salida definitiva que borra la configuración de bloqueo. Un sistema sin escape se desinstala; uno con escape se conserva.

---

## Stack

| Capa | Tecnología |
|---|---|
| Shell de escritorio | Tauri v2 |
| Backend nativo | Rust |
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind v4 |
| Persistencia | JSON en `%APPDATA%` (escritura atómica) |

Sin base de datos, sin backend remoto, sin cuentas, sin telemetría. Los datos no salen de la máquina.

---

## Requisitos

- [Rust](https://rustup.rs/) (toolchain estable)
- [Node.js](https://nodejs.org/) 18 o superior
- Microsoft C++ Build Tools (vienen con Visual Studio Build Tools)
- Windows 10 (versión 1803+) u 11

## Instalación

```bash
git clone https://github.com/USUARIO/foco.git
cd foco
npm install
```

Los íconos ya vienen generados en `src-tauri/icons/`. Para reemplazarlos:

```bash
npx tauri icon ruta/al/logo.png
```

## Desarrollo

El bloqueo escribe en el archivo `hosts` y necesita privilegios de administrador. **Abrí la terminal como administrador** y desde ahí:

```bash
npm run tauri dev
```

Sin elevación la aplicación abre igual, pero la pantalla de bloqueo avisa que no va a poder escribir.

## Compilar el instalador

```bash
npm run tauri build
```

Salida: `src-tauri/target/release/bundle/nsis/Foco_1.0.0_x64-setup.exe`

El instalador lleva el runtime de WebView2 embebido (`offlineInstaller`), por eso pesa unos 130 MB de más. Es intencional: cubre instalaciones de Windows 10 sin actualizar, donde WebView2 puede no estar presente.

Al ejecutarlo, SmartScreen va a advertir porque el binario no está firmado: *Más información → Ejecutar de todas formas*.

Para que la aplicación instalada pueda escribir el `hosts`, configurá el acceso directo como **Ejecutar como administrador** (clic derecho → Propiedades → Acceso directo → Opciones avanzadas).

## Tests

```bash
cd src-tauri && cargo test
```

---

## Estructura

```
docs/
  logo-light.png     Logo para fondo claro
  logo-dark.png      Logo para fondo oscuro
src/
  engine.ts          Motor de decisión: puntuación, archivado, métrica
  types.ts           Modelo de datos y migraciones
  api.ts             Puente con el backend Rust
  screens/
    Principal.tsx    Una tarea, dos botones
    Triage.tsx       Convertir capturas crudas en pasos concretos
    Todas.tsx        Verificar y editar (no elegir)
    Bloqueo.tsx      Sitios, candado, pases
src-tauri/src/
  hosts.rs           Escritura del archivo hosts, respaldo, caché DNS
  lib.rs             Comandos, estado del pase, vigilante
```

---

## Antes de confiar en el bloqueo

Los navegadores tienen configuración propia de DNS-over-HTTPS a nivel de aplicación, independiente del resolutor del sistema. Chromium consulta el archivo `hosts` por su cuenta; el comportamiento de otros navegadores varía por versión.

**Verificalo en tu máquina antes de asumir que funciona:**

1. Agregá a mano al archivo `hosts`: `0.0.0.0 tiktok.com`
2. Ejecutá `ipconfig /flushdns`
3. Probá en cada navegador instalado, con DoH activado y desactivado

## Restauración de emergencia

La aplicación guarda una copia del `hosts` original antes del primer bloqueo. Si algo sale mal, desde PowerShell como administrador:

```powershell
Copy-Item "$env:APPDATA\focus\hosts.backup" "C:\Windows\System32\drivers\etc\hosts" -Force
ipconfig /flushdns
```

## Archivos que crea

- `%APPDATA%\focus\store.json` — datos
- `%APPDATA%\focus\hosts.backup` — copia del `hosts` original

---

## Limitaciones conocidas

- **El bloqueo es fricción, no una pared.** Sos administrador de tu máquina y tenés el código: cualquier cosa que haga la aplicación, la podés deshacer. Ese es el diseño, no un defecto — un bloqueo imposible de levantar termina en desinstalación.
- **Los pesos del motor son una conjetura.** `Wu=4, Wt=2, Wf=1, Wr=3` en `engine.ts`. Están comentados como tales y hay que ajustarlos con el uso.
- **Solo Windows.** El módulo de `hosts` tiene la ruta de Linux como respaldo, pero no está probado.
- **Sin firma de código.** SmartScreen va a advertir.

## Descartado a propósito

Cosas que se evaluaron y se decidieron dejar afuera, para que no se propongan de nuevo:

- **Bloquear aplicaciones** (cerrar procesos). Funciona mal justo donde más se necesita: los juegos con anti-cheat a nivel de kernel resisten el cierre, y matar el proceso llega tarde por definición — interrumpís en vez de prevenir.
- **Aplicación de celular.** Los recordatorios se resuelven con las alarmas nativas del teléfono. Construir una app iOS habría requerido cuenta de desarrollador de Apple, una Mac y aprobación de entitlements.
- **Rachas de días consecutivos.** El corte genera culpa y la culpa genera abandono.
- **Sincronización entre dispositivos.** Elimina backend, cuentas y toda una capa de fallos.

## Licencia

MIT
