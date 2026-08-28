# Puesta en marcha desde cero

Este documento se usa una sola vez, para crear la estructura. Después queda como
referencia de convenciones de proyecto.

---

## 1. Estructura de repositorio

**Monorepo.** Una sola persona, un contrato de API compartido y tres piezas que
cambian juntas: separarlas en tres repos multiplica la coordinación sin dar nada.

```
almanaq/
├── CLAUDE.md              # instrucciones permanentes (raíz)
├── PLAN.md                # especificación completa
├── SETUP.md               # este archivo
├── .gitignore
├── design/
│   ├── tokens.json        # fuente única de color
│   ├── mockup-equipos.svg
│   ├── mockup-plataformas-v2.svg
│   └── paleta-sol-luna.svg
├── backend/               # Node + Hono
├── android/               # proyecto de Android Studio
└── ios/                   # proyecto de Xcode
```

Identificadores:

- Paquete Android: `com.almanaq.app`
- Bundle ID iOS: `com.almanaq.app`

```bash
mkdir almanaq && cd almanaq
git init
mkdir design backend android ios
# copiar CLAUDE.md, PLAN.md, SETUP.md a la raíz
# copiar tokens.json y los .svg a design/
```

---

## 2. Backend

Claude Code puede crear esto entero. Base:

```bash
cd backend
npm init -y
npm i hono @hono/node-server
npm i -D typescript tsx vitest @types/node
npx tsc --init
```

`package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc",
    "test": "vitest run",
    "build:holidays": "tsx scripts/build-holidays.ts"
  }
}
```

Estructura objetivo:

```
backend/
├── src/
│   ├── index.ts              # servidor Hono, rutas
│   ├── routes/
│   │   ├── availability.ts
│   │   ├── calendar.ts
│   │   ├── member.ts
│   │   └── locations.ts
│   ├── domain/
│   │   ├── workweek.ts       # tabla de semanas laborales
│   │   ├── holidays.ts       # lectura de data/holidays/*.json
│   │   ├── calendars.ts      # conversión vía Intl
│   │   └── status.ts         # resolución del enum de estado
│   └── data/
│       ├── workweeks.ts
│       └── holidays/         # JSON generados, commiteados
├── scripts/
│   └── build-holidays.ts     # correr 1 vez por año
└── tests/
```

### Verificación previa (antes de escribir nada más)

Correr esto en el runtime elegido. Si falla, el runtime no sirve para el proyecto:

```js
const d = new Date('2026-08-17');
for (const ca of ['hebrew', 'ethiopic', 'persian', 'islamic-umalqura']) {
  console.log(ca, new Intl.DateTimeFormat(`es-u-ca-${ca}`, { dateStyle: 'long' }).format(d));
}
```

Debe imprimir cuatro fechas distintas y correctas. Node estándar las soporta.

---

## 3. Android

**Crear el proyecto desde Android Studio, no con Claude Code.**

1. Android Studio → New Project → **Empty Activity** (con Compose).
2. Nombre: `Almanaq`. Paquete: `com.almanaq.app`.
3. Minimum SDK: **API 26** (Android 8.0). Cubre prácticamente todo el parque y
   evita compatibilidades innecesarias.
4. Build configuration language: **Kotlin DSL**.
5. Guardar en `almanaq/android`.

Estructura objetivo dentro de `app/src/main/java/com/almanaq/app/`:

```
├── MainActivity.kt
├── ui/
│   ├── theme/          # Color.kt, Theme.kt, Type.kt
│   ├── team/           # pantalla "Ahora"
│   ├── datepicker/     # pantalla "Elegir fecha"
│   └── member/         # pantalla "Detalle"
├── data/
│   ├── api/
│   └── local/
└── model/
```

Después, con el proyecto ya válido, Claude Code agrega:

- Retrofit u Ktor client + kotlinx.serialization
- DataStore para persistencia
- El esquema de Material 3 generado desde la semilla `#4436C7`
- Los Composables de las tres pantallas

**Generar el esquema de color** en Material Theme Builder con la semilla, exportar
como `Color.kt` + `Theme.kt`, y verificar que los roles de marca y estado coincidan
con `design/tokens.json`. La semilla genera tonos derivados; los colores de marca y
de estado no se tocan.

**Desactivar dynamic color explícitamente** en el `MaterialTheme`.

---

## 4. iOS

**Crear el proyecto desde Xcode, no con Claude Code.**

1. Xcode 26 → New Project → **App**.
2. Interface: **SwiftUI**. Language: **Swift**.
3. Nombre: `Almanaq`. Bundle ID: `com.almanaq.app`.
4. Minimum Deployment: **iOS 18** o superior según a quién quieras alcanzar.
   Compilar con el SDK de iOS 26 es obligatorio; el mínimo de despliegue es aparte.
5. Guardar en `almanaq/ios`.

Estructura objetivo dentro de `Almanaq/`:

```
├── AlmanaqApp.swift
├── Theme/          # Color+Tokens.swift, Typography.swift
├── Features/
│   ├── Team/       # pantalla "Ahora"
│   ├── DatePicker/ # pantalla "Elegir fecha"
│   └── Member/     # pantalla "Detalle"
├── Data/
│   ├── API/
│   └── Local/
└── Models/
```

Las carpetas de pantalla usan los mismos nombres conceptuales que en Android, para
poder comparar el avance de las dos plataformas de un vistazo.

Después, Claude Code agrega:

- Capa de red con `URLSession` y `Codable` (sin dependencias externas)
- Persistencia en archivo JSON en Documents
- `Color+Tokens.swift` derivado de `design/tokens.json`
- Las vistas SwiftUI de las tres pantallas

**Confirmar que Liquid Glass está activo:** los componentes estándar deben verse
translúcidos al compilar. Si se ven como antes, revisar que no exista
`UIDesignRequiresCompatibility` en el Info.plist.

---

## 5. `.gitignore`

```gitignore
# Node
node_modules/
dist/
.env

# Android
android/.gradle/
android/build/
android/app/build/
android/local.properties
android/.idea/

# iOS
ios/build/
ios/DerivedData/
*.xcuserstate
ios/**/xcuserdata/

# Sistema
.DS_Store
```

**No ignorar** `backend/src/data/holidays/`. Esos JSON se commitean a propósito.

---

## 6. Orden de la primera semana

1. Crear estructura de carpetas y `git init`.
2. Copiar los documentos y los assets de diseño.
3. Correr la verificación de `Intl`.
4. Backend: tabla de semanas laborales + script de feriados.
5. Backend: los cuatro endpoints con tests.
6. **Congelar el contrato de API.**
7. Recién ahí: crear los proyectos de Android Studio y Xcode.

No crear los proyectos móviles antes del punto 6. Tener dos apps esperando un
contrato que todavía se mueve es la forma más rápida de duplicar retrabajo.

---

## 7. Primer pedido sugerido a Claude Code

> Leé CLAUDE.md y PLAN.md. Vamos a empezar por el backend.
>
> Primero, verificá el soporte de Intl con calendarios no gregorianos en este Node.
> Después creá la estructura de `backend/` según SETUP.md sección 2, con la tabla de
> semanas laborales de la sección 5 del plan y el script `build-holidays.ts`.
>
> No implementes los endpoints todavía. Quiero revisar la capa de dominio primero.

Pedir la capa de dominio antes que los endpoints permite revisar las decisiones
difíciles (calendarios, feriados, semanas laborales) mientras el código todavía es
chico.
