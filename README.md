# 🐶❤️ CoCoCorre

Un juego arcade hecho con amor para **María Isabel**: ayuda a **Coco** (un Pomerania) a cruzar calles, ríos y vías de tren, gana puntos y cámbialos por recompensas reales (abrazos, besos, Nucitas…).

- 🕹️ Juego infinito generado por carriles, con 10 niveles de dificultad según los puntos.
- 🔐 Cuentas con usuario y contraseña (Firebase Authentication).
- 🪙 Los puntos de cada partida se suman a un saldo guardado en Firestore.
- 🎁 14 recompensas en **escalera**: cada una se reclama una sola vez y, al reclamar una, las anteriores no reclamadas se bloquean (validado por las reglas de Firebase).
- 🏅 Ranking global con los récords de todas las jugadoras.
- 🔧 Panel de administración: usuarios, recompensas, historial y configuración.
- 🌐 Se publica gratis en **GitHub Pages**, con Firebase como backend (plan gratuito *Spark*).

---

## Índice

1. [Arquitectura](#1-arquitectura)
2. [Estructura del proyecto](#2-estructura-del-proyecto)
3. [Base de datos (Firestore)](#3-base-de-datos-firestore)
4. [Seguridad](#4-seguridad)
5. [Cómo se juega](#5-cómo-se-juega)
6. [Instalación y desarrollo local](#6-instalación-y-desarrollo-local)
7. [Variables de entorno](#7-variables-de-entorno)
8. [**Guía paso a paso para ponerlo en línea**](#8-guía-paso-a-paso-para-ponerlo-en-línea) ⭐
9. [Recompensas (escalera)](#9-recompensas-escalera)
10. [Personalizar el juego](#10-personalizar-el-juego)
11. [Problemas frecuentes](#11-problemas-frecuentes)

---

## 1. Arquitectura

```
┌──────────────────────────── Navegador ────────────────────────────┐
│  React (pantallas: login, menú, recompensas, perfil, admin)      │
│  Canvas 2D (motor del juego: carriles, colisiones, dibujo)        │
│  Firebase JS SDK  ───────────────┐                                 │
└──────────────────────────────────┼─────────────────────────────────┘
        ▲ archivos estáticos        │ HTTPS
        │                           ▼
┌───────┴────────┐        ┌─────────────────────────────────┐
│  GitHub Pages  │        │ Firebase                         │
│ (HTML/JS/CSS)  │        │  • Authentication (usuario/clave)│
└────────────────┘        │  • Cloud Firestore (datos)       │
                          │  • Security Rules (validación)   │
                          └─────────────────────────────────┘
```

| Tecnología | Por qué |
|---|---|
| **Vite + React + TypeScript** | Compila a archivos estáticos (lo único que GitHub Pages puede servir). React simplifica las pantallas y formularios; TypeScript evita errores. |
| **Canvas 2D** (sin motor externo) | El juego es sencillo; dibujar en canvas es muy rápido, funciona en todos los navegadores y no añade dependencias pesadas. |
| **Firebase Authentication** | Inicio de sesión seguro sin programar un servidor. |
| **Cloud Firestore + Security Rules** | Base de datos en tiempo real. **Toda** la validación crítica (saldo, reclamaciones, admin) se hace con reglas en los servidores de Google. |
| **Sin Cloud Functions ni Storage** | Ambos exigen el plan de pago *Blaze*. Las reglas son suficientes para la lógica, y las imágenes se guardan como emoji, URL o imagen reducida dentro del documento. **Todo funciona en el plan gratuito.** |
| **GitHub Actions** | Compila y publica automáticamente en cada `git push`. |

**Usuario y contraseña:** Firebase necesita un correo, así que el juego convierte el usuario en un correo interno que nunca se usa para enviar nada: `mari` → `mari@cococorre.app`. La jugadora sólo ve "Usuario" y "Contraseña".

**Navegación:** la app no usa rutas de URL (todo ocurre en `index.html`), así que no hay errores 404 en GitHub Pages y funciona con cualquier nombre de repositorio (`base: './'` en `vite.config.ts`).

---

## 2. Estructura del proyecto

```
├── .github/workflows/deploy.yml   # Compila y publica en GitHub Pages
├── firestore.rules                # ⚠️ Reglas de seguridad (lo más importante)
├── firebase.json                  # Config. para Firebase CLI / emuladores (opcional)
├── .env.example                   # Plantilla de variables de entorno
├── index.html
├── public/favicon.svg
├── tests/rules.test.mjs           # Pruebas de las reglas (opcional)
└── src/
    ├── main.tsx, App.tsx          # Entrada y navegación entre pantallas
    ├── config.ts                  # Nombre del juego, dominio interno de usuarios
    ├── firebase/                  # Conexión y operaciones con Firebase
    │   ├── app.ts                 #   inicialización
    │   ├── auth.ts                #   registro / login / logout
    │   ├── users.ts               #   perfil y registro de partidas
    │   ├── rewards.ts             #   recompensas y reclamaciones (transacción)
    │   ├── admin.ts, gameConfig.ts, types.ts, errors.ts
    ├── auth/                      # Contexto de sesión y pantalla de login/registro
    ├── game/                      # Motor del juego
    │   ├── Game.ts                #   bucle, movimiento, colisiones, cámara
    │   ├── generator.ts           #   generación de carriles y dificultad
    │   ├── render.ts              #   dibujo (Coco, autos, trenes, río…)
    │   ├── input.ts               #   teclado y gestos táctiles
    │   ├── characters.ts          #   personajes (colores de Coco)
    │   └── audio.ts, types.ts
    ├── screens/                   # Menú, juego (HUD), game over, perfil
    ├── rewards/                   # Pantalla de recompensas + recompensas iniciales
    ├── admin/                     # Panel de administración
    ├── components/                # Logo, modal, confeti, etc.
    └── styles/global.css
```

---

## 3. Base de datos (Firestore)

```
users/{uid}                     ← perfil de cada jugadora
    username, usernameLower
    points          (saldo para recompensas)
    highScore, gamesPlayed, lastScore, lastGameAt
    claimedCount, lastClaim
    maxOrder        (escalón más alto reclamado en la escalera de recompensas)
    createdAt

games/{uid}_{número}            ← historial de partidas
    userId, username, score, playedAt

rewards/{rewardId}              ← creadas por el administrador
    name, description, cost, difficulty, image, active, order, createdAt, updatedAt

claims/{uid}_{rewardId}         ← reclamaciones (permanentes)
    userId, username, rewardId, rewardName, cost, claimedAt

leaderboard/{uid}               ← ranking público (copia del récord)
    username, highScore, gamesPlayed, updatedAt

admins/{uid}                    ← sólo se crea desde la consola de Firebase
config/game                     ← mensajes y dificultad (editable por admin)
```

**¿Por qué `claims/{uid}_{rewardId}` y no un ID aleatorio?**
Porque el ID **es** la regla "una vez por usuario": sólo puede existir un documento `mari123_beso`. Las reglas exigen que no exista antes (`!exists(...)`), así que es imposible reclamar dos veces aunque se manipule el navegador. Se eligió una colección global (en vez de `users/{uid}/claimedRewards`) porque así el administrador consulta todo el historial con una sola consulta, y la seguridad es la misma.

---

## 4. Seguridad

Todo lo crítico se valida en [`firestore.rules`](firestore.rules), en los servidores de Google. Aunque alguien abra la consola del navegador y escriba código, las reglas lo rechazan:

| Intento de trampa | Qué lo impide |
|---|---|
| Cambiar `points: 100` → `999999` | Un usuario **sólo** puede sumar `lastScore` al terminar una partida, o restar el costo exacto de una recompensa. Cualquier otro cambio se rechaza. |
| Inventar una partida de 5.000 puntos | Tope por partida y límite de tiempo: deben haber pasado al menos 60 ms por cada punto desde la partida anterior (Coco tarda 140 ms por salto). Además cada partida debe registrarse en `games/`. |
| Reclamar dos veces | `claims/{uid}_{rewardId}` no puede existir antes; nadie puede borrar ni editar reclamaciones. |
| Reclamar una recompensa ya bloqueada | Escalera: sólo se puede reclamar una recompensa con `order` mayor que `maxOrder`, y `maxOrder` sólo sube al reclamar (nadie puede bajarlo). |
| Pagar menos por una recompensa | La regla lee el costo **real** desde `rewards/{id}` y exige que el saldo baje exactamente eso, en la misma operación atómica. |
| Saldo negativo / recompensa inactiva | Rechazado (`points >= 0`, `active == true`). |
| Editar recompensas, costos o configuración | Sólo administradores. |
| Ver o modificar a otros usuarios | Cada quien sólo lee su propio perfil y sus reclamaciones. |
| Inflar su puesto en el ranking | `leaderboard/{uid}` sólo acepta valores **idénticos** al récord y partidas del perfil protegido, y cada quien sólo escribe su propia entrada. El ranking sólo muestra usuario, récord y partidas (nunca el saldo). |
| Hacerse administrador / entrar a `#admin` | Ser admin = existir en `admins/{uid}`, que **sólo** se puede crear desde la consola de Firebase (`allow write: if false`). Ocultar el botón en la interfaz es comodidad; la protección real es la regla. |
| Ponerse puntos al crear la cuenta | El perfil sólo puede crearse con todo en 0 y con el usuario que coincide con la cuenta. |

> **Límite honesto:** en cualquier juego que corre en el navegador, alguien con conocimientos técnicos podría enviar una puntuación falsa *dentro de los límites* (máximo 5.000 por partida y no más rápido de lo humanamente posible). Las **recompensas** sí quedan 100 % protegidas: nunca se pueden reclamar dos veces, ni pagar menos, ni gastar puntos que no se tienen. El administrador puede revisar el historial de partidas y ajustar puntos si ve algo raro.

Las reglas incluyen pruebas automáticas en `tests/rules.test.mjs` (15 casos) — ver [Problemas frecuentes](#11-problemas-frecuentes) para ejecutarlas.

---

## 5. Cómo se juega

| | PC | Celular |
|---|---|---|
| Avanzar | ⬆️ / W / Espacio | Tocar la pantalla o deslizar ↑ |
| Retroceder | ⬇️ / S | Deslizar ↓ |
| Izquierda / derecha | ⬅️ ➡️ / A D | Deslizar ← → |

- **+1 punto** por cada fila nueva alcanzada, **+3** por cada ❤️ recogido.
- Carreteras 🚗, ríos 🌊 (hay que saltar sobre troncos u hojas), vías de tren 🚆 (el semáforo parpadea antes de que pase el tren).
- Si Coco se queda muy atrás, la cámara lo deja… ¡hay que seguir avanzando!
- **La dificultad sube con los puntos:** cada 30 puntos se sube un nivel (se ve en pantalla), hasta el nivel 10 (270 puntos). Desde ahí ya no sube más, para que nunca sea imposible:

  | Puntos | Nivel | Velocidad autos (casillas/s) | Hueco mínimo entre autos | Avance de la cámara |
  |---|---|---|---|---|
  | 0 | 1 | 1,1 – 2,0 | 5 casillas | 0,22 filas/s |
  | 90 | 4 | 2,1 – 3,0 | 4,1 | 0,35 |
  | 150 | 6 | 2,8 – 3,7 | 3,4 | 0,43 |
  | 270+ | 10 (máx.) | 4,1 – 5,0 | 2,2 | 0,60 |

  Además: menos zonas seguras (pero al menos 45 % de las veces hay una tras un tramo peligroso), más camiones, ríos más rápidos (troncos de mínimo 2 casillas) y trenes más frecuentes (siempre con aviso del semáforo). Todo se ajusta en `src/game/difficulty.ts` y `src/game/generator.ts`.
- Al morir, la puntuación se suma automáticamente al saldo.

---

## 6. Instalación y desarrollo local

Requisitos: [Node.js](https://nodejs.org) 20 o superior (recomendado: la versión LTS).

```bash
npm install          # instala dependencias
cp .env.example .env # luego completa .env (ver sección 7)
npm run dev          # abre http://localhost:5173
npm run build        # compila la versión de producción en dist/
npm run preview      # sirve dist/ localmente para probarla
```

---

## 7. Variables de entorno

Archivo `.env` (local) — **nunca se sube a GitHub** (está en `.gitignore`):

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=cococorre-xxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=cococorre-xxxx
VITE_FIREBASE_STORAGE_BUCKET=cococorre-xxxx.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123...
```

Todos estos valores salen de **Firebase Console → ⚙️ Configuración del proyecto → General → Tus apps → (tu app web) → Configuración del SDK → Config** (ver [Paso 3](#paso-3--registrar-la-app-web-y-copiar-la-configuración)).

### ¿Qué es público y qué es secreto?

✅ **Públicos por diseño** (es normal que estén en el JavaScript del sitio): los 6 valores `VITE_FIREBASE_*`. Sólo identifican tu proyecto; **no dan permisos**. La protección la dan las *Security Rules*. Aun así, los guardamos en *GitHub Secrets* para no tenerlos en el código y poder cambiarlos fácilmente.

❌ **Nunca deben exponerse** (y este proyecto no los necesita):
- Archivos de **cuenta de servicio** (`serviceAccountKey.json`, claves privadas del Admin SDK).
- Tokens de GitHub, contraseñas de cuentas, tokens de `firebase login:ci`.
- Si alguna vez se filtra algo de esto, revócalo de inmediato en Google Cloud / GitHub.

---

## 8. Guía paso a paso para ponerlo en línea

> Tiempo estimado: 30–45 minutos. Sólo necesitas una cuenta de Google y una de GitHub. Todo es gratis.
> (Los nombres de los botones pueden variar un poco según el idioma y la versión de la consola.)

### PASO 1 — Crear el proyecto en Firebase

1. Entra a **https://console.firebase.google.com** con tu cuenta de Google.
2. Haz clic en **"Crear un proyecto"** (o *"Comenzar con un proyecto de Firebase"*).
3. Nombre: `cococorre` (Firebase le agregará un sufijo, p. ej. `cococorre-a1b2c`). Acepta las condiciones → **Continuar**.
4. Google Analytics: **desactívalo** (no se necesita) → **Crear proyecto**.
5. Espera a que termine y haz clic en **Continuar**.

### PASO 2 — Activar Authentication (usuario y contraseña)

1. En el menú izquierdo: **Compilación (Build) → Authentication**.
2. Clic en **"Comenzar"**.
3. Pestaña **"Método de acceso" (Sign-in method)** → en *Proveedores nativos* elige **"Correo electrónico/contraseña"**.
4. Activa el **primer** interruptor (*Correo electrónico/contraseña*). Deja **desactivado** "Vínculo del correo electrónico (acceso sin contraseña)".
5. **Guardar**.

> No hace falta verificar correos: el juego usa correos internos (`usuario@cococorre.app`) que nunca reciben mensajes.

### PASO 3 — Registrar la app web y copiar la configuración

1. Clic en el **⚙️ engranaje** (arriba a la izquierda, junto a "Descripción general del proyecto") → **Configuración del proyecto**.
2. Baja hasta **"Tus apps"** y haz clic en el icono **`</>`** (Web).
3. Apodo: `CoCoCorre web`. **No** marques "Firebase Hosting" (usaremos GitHub Pages). → **Registrar app**.
4. Verás un bloque como este. **Copia estos valores**, los necesitarás en el Paso 10:
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",               // -> VITE_FIREBASE_API_KEY
     authDomain: "cococorre-xxxx.firebaseapp.com",    // -> VITE_FIREBASE_AUTH_DOMAIN
     projectId: "cococorre-xxxx",       // -> VITE_FIREBASE_PROJECT_ID
     storageBucket: "cococorre-xxxx.firebasestorage.app", // -> VITE_FIREBASE_STORAGE_BUCKET
     messagingSenderId: "1234567890",   // -> VITE_FIREBASE_MESSAGING_SENDER_ID
     appId: "1:1234567890:web:abc..."   // -> VITE_FIREBASE_APP_ID
   };
   ```
5. **Continuar a la consola**. (Si los pierdes, siempre están en ⚙️ → Configuración del proyecto → Tus apps.)

### PASO 4 — Crear la base de datos Firestore

1. Menú izquierdo: **Compilación → Firestore Database** → **"Crear base de datos"**.
2. Edición: **Standard** (si lo pregunta).
3. **ID de la base de datos:** deja `(default)`.
4. **Ubicación:** elige una cercana, por ejemplo `southamerica-east1 (São Paulo)` o `nam5 (United States)`. *No se puede cambiar después.*
5. **Reglas:** elige **"Comenzar en modo de producción"** (todo bloqueado; en el siguiente paso ponemos las nuestras).
6. **Crear**.

### PASO 5 — Instalar las reglas de seguridad

1. En **Firestore Database**, abre la pestaña **"Reglas" (Rules)**.
2. Borra todo el contenido del editor.
3. Abre el archivo [`firestore.rules`](firestore.rules) de este proyecto, **copia todo** y pégalo en el editor.
4. Clic en **"Publicar"**. Debe decir que se publicaron correctamente.

> Cada vez que modifiques `firestore.rules`, repite este paso (o usa `npx firebase-tools deploy --only firestore:rules`).

### PASO 6 — Storage (NO es necesario)

Este proyecto **no usa Firebase Storage** (para proyectos nuevos exige el plan de pago). Las imágenes de las recompensas pueden ser:
- un **emoji** (🎁 🍫 🍦 …),
- una **URL** `https://…` de una imagen pública, o
- una imagen que subes desde el panel de admin: el juego la reduce a 256 px y la guarda dentro del documento de Firestore.

Puedes saltarte este paso. ✅

### PASO 7 — Crear el repositorio en GitHub

1. Entra a **https://github.com** → botón **"+"** (arriba a la derecha) → **"New repository"**.
2. **Repository name:** `cococorre` (la URL del juego será `https://TU-USUARIO.github.io/cococorre/`).
3. Visibilidad: **Public** (GitHub Pages es gratis para repositorios públicos; en privados requiere GitHub Pro). No se publica nada secreto: el `.env` no se sube.
4. **No** marques "Add a README", ".gitignore" ni licencia (el proyecto ya los tiene).
5. **Create repository**. Deja abierta la página: muestra la URL del repositorio (`https://github.com/TU-USUARIO/cococorre.git`).

### PASO 8 — Subir el código

Abre una terminal **en la carpeta del proyecto** (en VS Code: *Terminal → New Terminal*) y ejecuta:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/cococorre.git
git push -u origin main
```

- `git init` — convierte la carpeta en un repositorio.
- `git add .` — prepara todos los archivos (excepto los de `.gitignore`: `node_modules`, `dist`, `.env`).
- `git commit` — guarda una "foto" del código.
- `git branch -M main` — nombra la rama principal `main`.
- `git remote add origin …` — conecta con tu repositorio de GitHub.
- `git push` — sube el código. La primera vez te pedirá iniciar sesión en GitHub (se abre el navegador).

> Si `git commit` dice *"Please tell me who you are"*, ejecuta primero:
> `git config --global user.name "Tu Nombre"` y `git config --global user.email "tu@correo.com"`.

### PASO 9 — Activar GitHub Pages con GitHub Actions

1. En tu repositorio de GitHub: **Settings** (pestaña de arriba) → menú izquierdo **Pages**.
2. En **"Build and deployment" → Source**, selecciona **"GitHub Actions"**.
3. Listo: no hay que elegir rama ni carpeta. El archivo `.github/workflows/deploy.yml` del proyecto ya sabe compilar y publicar.

### PASO 10 — Variables de entorno de producción (GitHub Secrets)

1. En el repositorio: **Settings → Secrets and variables → Actions**.
2. Pestaña **"Secrets"** → botón **"New repository secret"**.
3. Crea estos **6 secrets** (nombre exacto, y como valor el texto del Paso 3 **sin comillas**):

   | Name | Secret (ejemplo) |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | `AIzaSy...` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `cococorre-xxxx.firebaseapp.com` |
   | `VITE_FIREBASE_PROJECT_ID` | `cococorre-xxxx` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `cococorre-xxxx.firebasestorage.app` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `1234567890` |
   | `VITE_FIREBASE_APP_ID` | `1:1234567890:web:abc...` |

4. **Primer despliegue:** ve a la pestaña **Actions** → workflow **"Desplegar en GitHub Pages"** → botón **"Run workflow"** → **Run workflow**. (El push del paso 8 ya lo ejecutó una vez, pero sin los secrets; hay que volver a correrlo.)
5. Espera ~1–2 minutos a que ambos pasos (*build* y *deploy*) tengan ✅ verde.
6. La URL aparece en el paso *deploy* y en **Settings → Pages**: `https://TU-USUARIO.github.io/cococorre/`.

> A partir de ahora, **cada `git push` a `main` publica automáticamente** la nueva versión.

### PASO 11 — Autorizar el dominio de GitHub Pages en Firebase

1. Firebase Console → **Authentication → Configuración (Settings) → Dominios autorizados**.
2. **Agregar dominio** → escribe `TU-USUARIO.github.io` (sin `https://` ni `/cococorre`) → **Agregar**.

> Con usuario/contraseña el login funciona igual, pero autorizar el dominio es lo correcto y será necesario si algún día agregas inicio con Google.

**Opcional (más protección):** en [Google Cloud Console → APIs y servicios → Credenciales](https://console.cloud.google.com/apis/credentials), abre la *Browser key* de tu proyecto → *Restricciones de aplicación* → **Sitios web** → agrega `https://TU-USUARIO.github.io/*` y `http://localhost:5173/*`. Así la API key sólo funciona desde tu juego.

### PASO 12 — Crear el usuario administrador

El administrador se crea a mano desde la consola de Firebase: así **nadie** puede darse permisos desde el navegador.

1. Abre tu juego (`https://TU-USUARIO.github.io/cococorre/`) y **crea una cuenta** para ti (p. ej. usuario `admin` o tu nombre). Usa una contraseña fuerte.
2. Firebase Console → **Authentication → Usuarios**. Busca `admin@cococorre.app` (o `tuusuario@cococorre.app`) y **copia su "UID de usuario"** (un texto como `Xb1hlgHrqHmyGQMJtirADwMjWzmW`).
3. Firebase Console → **Firestore Database → Datos** → **"+ Iniciar colección"**:
   - **ID de la colección:** `admins` → Siguiente.
   - **ID del documento:** pega el **UID** (¡no uses "ID automático"!).
   - Agrega un campo: nombre `nota`, tipo `string`, valor `administrador`.
   - **Guardar**.
4. Vuelve al juego y **recarga la página**. En el menú aparecerá **🔐 ADMINISTRACIÓN**.
5. Entra → **Recompensas** → **"Cargar catálogo de 14 recompensas"** → **Cargar**. Edita costos, textos o imágenes cuando quieras.

> Para quitar a un administrador, borra su documento en `admins`. Para agregar otro, crea otro documento con su UID.

### PASO 13 — Probar todo ✅

| Prueba | Cómo | Resultado esperado |
|---|---|---|
| Registro | "Crear cuenta" con usuario nuevo | Entra al menú; en Firestore aparece `users/{uid}` |
| Validaciones | Contraseñas distintas, usuario con espacios, usuario repetido | Mensajes de error claros |
| Login / logout | Cerrar sesión e iniciar de nuevo | Conserva puntos y récord |
| Juego | Mover con flechas o tocando | Coco avanza, autos se mueven, sube PUNTOS |
| Muerte | Chocar con un auto / caer al río | Pantalla GAME OVER |
| Puntos | Ver "Saldo anterior / Partida / Puntos acumulados" | El saldo se suma y persiste al recargar |
| Récord | Superar la mejor marca | "✨ ¡NUEVO RÉCORD! ✨" |
| Recompensas | Menú → Recompensas | Lista con costos y barra de progreso |
| Reclamar | Con puntos suficientes → RECLAMAR → confirmar | Animación, saldo descontado, "RECLAMADA ✓" |
| Doble reclamación | Intentar de nuevo | No se puede (ni desde la consola del navegador) |
| Admin | Crear, editar, desactivar recompensa; ver Usuarios e Historial | Cambios visibles al instante para la jugadora |
| Usuario normal | Entrar con una cuenta no-admin | No ve "Administración"; `#admin` muestra "Acceso restringido" |

¡Y a regalarle el link a María Isabel! 💝

---

## 9. Recompensas (escalera)

Las recompensas funcionan como una **escalera** según su campo **Orden**: si se reclama una, **todas las anteriores que no se hayan reclamado se bloquean para siempre**. La pantalla de recompensas lo explica y, antes de reclamar, muestra un aviso con la lista exacta de lo que se bloqueará. Así cada decisión cuenta: ¿gastar ya o ahorrar para algo más grande?

| # | Recompensa | Costo | | # | Recompensa | Costo |
|---|---|---|---|---|---|---|
| 1 | Un abrazo | 150 | | 8 | Unas mandingas | 2.200 |
| 2 | Un beso | 300 | | 9 | Unas Kitchen | 2.800 |
| 3 | Un dulce | 500 | | 10 | Crepes & Waffles | **5.000** |
| 4 | Una Nucita | 750 | | 11 | Ida a cine | **8.000** |
| 5 | Una Gol | 1.000 | | 12 | Una camisa | **12.000** |
| 6 | Una chocolatina | 1.300 | | 13 | Ir a saltar a los Molinos | **17.000** |
| 7 | Un helado | 1.700 | | 14 | Una salida con almuerzo | **24.000** |

Referencia: una partida normal da ~40–80 puntos y una muy buena 150 o más. Las primeras se consiguen en pocos días; de la 10 en adelante son metas de semanas.
Para cargarlas: **Administración → Recompensas → "Cargar catálogo de 14 recompensas"**. Crea o actualiza las 14 (si ya existían "Un abrazo", "Un beso", etc., se actualizan) y desactiva las que no estén en la lista; las reclamaciones hechas se conservan. El catálogo está en `src/rewards/defaultRewards.ts`.

> Si cambias el **Orden** de una recompensa desde el panel, cambia su lugar en la escalera.

## 10. Personalizar el juego

- **Recompensas, costos, imágenes y mensajes:** desde el panel 🔐 Administración (no hace falta tocar código).
- **Dificultad general:** Administración → Configuración → *Velocidad de los obstáculos*.
- **Dar puntos de regalo:** Administración → Usuarios → *Ajustar puntos*.
- **Personajes:** Coco es un Pomerania sable (como el de verdad); también hay Coco Crema y Coco Naranja. Para agregar otro, añade sus colores en `src/game/characters.ts`.
- **Puntos por nivel / nivel máximo:** `src/game/difficulty.ts`.
- **Velocidades y topes de cada nivel, tipos de carril:** `src/game/generator.ts`.
- **Puntos por corazón, duración del salto:** `src/game/types.ts`.
- **Nombre de la jugadora:** `src/config.ts`.

---

## 11. Problemas frecuentes

**La página dice "Falta configurar Firebase"** → faltan los secrets del Paso 10 (o el `.env` local). Revisa los nombres exactos y vuelve a ejecutar el workflow.

**"Usuario o contraseña incorrectos" con datos correctos** → verifica que *Correo electrónico/contraseña* esté activado (Paso 2) y que el `VITE_FIREBASE_API_KEY` sea correcto.

**"Operación no permitida" o "No se pudieron guardar los puntos"** → las reglas no se publicaron (Paso 5) o se copiaron incompletas.

**No aparece el botón de Administración** → el ID del documento en `admins` debe ser **exactamente** el UID (Paso 12) y hay que recargar la página.

**El workflow falla en `npm ci`** → asegúrate de haber subido `package-lock.json`.

**Página en blanco / 404 en GitHub Pages** → en Settings → Pages la fuente debe ser **GitHub Actions** (Paso 9).

**El ranking aparece vacío o no se actualiza** → vuelve a publicar `firestore.rules` (Paso 5): la regla de `leaderboard` se agregó después. Cada jugadora aparece al iniciar sesión o terminar una partida.

**Ejecutar las pruebas de las reglas (opcional, requiere Java 21+):**
```bash
npm i -D firebase-tools @firebase/rules-unit-testing
npx firebase emulators:exec --only firestore --project demo-cococorre "node --test tests/rules.test.mjs"
```

**Probar todo localmente sin un proyecto real (emuladores):**
```bash
npx firebase-tools emulators:start --only auth,firestore --project demo-cococorre
# en otra terminal (PowerShell: $env:VITE_USE_EMULATORS="true"; npm run dev)
VITE_USE_EMULATORS=true npm run dev
```

---

Hecho con ❤️ para María Isabel (y para Coco 🐶).
"# cococorre" 
"# cococorre" 
