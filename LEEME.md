# Foco — v1

Implementa las fases 1, 2 y 3 del documento de arquitectura.
Fase 4 (notificaciones, autostart) no está incluida.

## Cambios respecto del documento

- Se eliminó la nota diaria y la pantalla de historia (secciones 3.1 `DayRecord.note`
  y 7.4). No aportaban a decidir ni a volver.
- Se agregó la pantalla **todas**: lista completa de tareas, editable y con el
  puntaje del motor visible. No estaba en el documento y era un hueco: sin ella
  no hay forma de verificar qué cargaste ni de corregir un error.
  La pantalla principal sigue mostrando una tarea y dos botones.
- La navegación pasó de accesos ocultos en la esquina a una barra fija inferior.
- Modo oscuro: claro u oscuro, nada más. La primera vez toma la preferencia
  del sistema; después es manual y queda guardada.
- **Pasos múltiples por tarea.** Una tarea ya no es una sola acción: es un
  contenedor con pasos ordenados. `Task.move` (string) pasó a `Task.title` +
  `Task.steps[]`. La migración corre sola al cargar un store viejo.
  La pantalla principal muestra el paso actual grande y los siguientes
  apagados debajo; completar un paso avanza al siguiente y solo marca la
  tarea como hecha cuando no queda ninguno.
- **La duración se define por paso, no por tarea.** `Task.size` pasó a
  `Step.size`. El motor mide la facilidad sobre el paso actual, que es lo
  correcto: lo que importa para arrancar es cuánto cuesta el próximo paso.
- **Bloqueo de aplicaciones** (`src-tauri/src/procesos.rs`). Un vigilante en
  Rust cierra cada 3 segundos los ejecutables de la lista. Ver la sección
  "Límites del bloqueo de aplicaciones" más abajo.

## Requisitos previos

- Rust (toolchain estable) y Node 18+
- En Windows: Microsoft C++ Build Tools (viene con Visual Studio Build Tools)

## Instalación

```bash
npm install
```

Los íconos ya vienen generados en `src-tauri/icons/`. Para reemplazarlos por
uno propio, poné un PNG de 1024x1024 con transparencia y corré:

```bash
npx tauri icon ruta/al/logo.png
```

`npx tauri icon` sin argumentos usa `app-icon.png` de la raíz del proyecto
(incluido). No genera nada por defecto si ese archivo no existe.

## Ejecutar en desarrollo

El bloqueo escribe en el archivo hosts y necesita privilegios de
administrador. **Abrí la terminal como administrador** y desde ahí:

```bash
npm run tauri dev
```

Sin elevación la aplicación abre igual, pero la pantalla de bloqueo avisa
que no va a poder escribir.

## Compilar el instalador

```bash
npm run tauri build
```

Salida: `src-tauri/target/release/bundle/nsis/Foco_1.0.0_x64-setup.exe`

El instalador lleva WebView2 embebido (`offlineInstaller`), por eso pesa
unos 130 MB de más. Es intencional: cubre Windows 10 sin actualizar.

Al ejecutarlo, SmartScreen va a advertir porque no está firmado:
*Más información → Ejecutar de todas formas*.

Para que la aplicación instalada pueda escribir el hosts, el acceso directo
tiene que configurarse como **Ejecutar como administrador**
(clic derecho → Propiedades → Acceso directo → Opciones avanzadas).

## Tests del backend

```bash
cd src-tauri && cargo test
```

## Archivos que crea la aplicación

- `%APPDATA%\focus\store.json` — datos
- `%APPDATA%\focus\hosts.backup` — copia del hosts original, antes del primer bloqueo

## Restauración de emergencia

Si el archivo hosts queda mal y la aplicación no abre, desde PowerShell
como administrador:

```powershell
Copy-Item "$env:APPDATA\focus\hosts.backup" "C:\Windows\System32\drivers\etc\hosts" -Force
ipconfig /flushdns
```

## Antes de confiar en el bloqueo

Correr el Test 0 de la sección 9.1 del documento de arquitectura.
Los navegadores tienen DNS-over-HTTPS propio y el resultado hay que
medirlo, no asumirlo.


## Límites del bloqueo de aplicaciones

El mecanismo es un vigilante que cada 3 segundos ejecuta `taskkill /F` sobre
los ejecutables de la lista. Consecuencias que conviene tener presentes:

- **Cierre forzado, sin guardar.** Nunca agregues a la lista una aplicación
  donde puedas tener trabajo sin guardar.
- **Se esquiva renombrando el ejecutable.** Es fricción, no una pared.
  Igual que el archivo hosts.
- **Hay una lista de procesos protegidos** en `procesos.rs` que nunca se
  cierran (explorer.exe, svchost.exe, lsass.exe y demás). La verificación
  está en Rust y no en la interfaz a propósito: es un guardarraíl, no una
  preferencia. Si agregás procesos a la lista de bloqueo, revisá antes que
  no sean del sistema.
- **Requiere permisos de administrador** para cerrar procesos que no sean
  del propio usuario.
- El pase temporal también levanta el bloqueo de aplicaciones, no solo el
  de sitios.
