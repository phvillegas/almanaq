# Almanaq — Plan de producto y técnico

App de disponibilidad para equipos distribuidos.

Documento de referencia para el asistente de código. Contiene alcance, arquitectura,
contrato de API, sistema de diseño y especificación de pantallas.

**Leé este documento entero antes de escribir código.** La sección "Reglas de trabajo"
al final define límites que no hay que cruzar.

---

## 1. Producto

### Qué es

Una app que responde una pregunta: **¿quién de mi equipo está realmente disponible
ahora, y qué días conviene evitar?**

La diferencia con cualquier conversor de husos horarios es que tiene en cuenta el
**calendario local** de cada persona, no solo la hora: fines de semana que no son
sábado y domingo, feriados nacionales, y festividades que se rigen por calendarios
no gregorianos y por lo tanto se mueven cada año.

### Para quién

Personas que coordinan con colegas en otros países. El caso que define el producto:
es viernes al mediodía en Buenos Aires, parece un día laboral normal, y la mitad del
equipo está de fin de semana o de feriado.

### Qué NO es

- No es una app de calendarios curiosos ni un catálogo cultural.
- No es multiplayer. **Nadie más que el usuario instala nada.**
- No es un chat, ni una agenda, ni un CRM.

### Modelo single-player (crítico)

El usuario agrega personas con **nombre + ciudad**. La app infiere todo lo demás
(huso horario, país, semana laboral, feriados) desde datos públicos.

Las personas agregadas **no tienen cuenta, no reciben nada, no confirman nada.**
Esta decisión es lo que hace viable el producto: no depende de la adopción de nadie.

---

## 2. Alcance v1

### Dentro

1. Agregar y quitar miembros del equipo (nombre + ciudad).
2. Vista "Ahora": estado de disponibilidad de cada miembro en tiempo real.
3. Vista "Elegir fecha": calendario mensual con días conflictivos marcados y
   resumen de quién no está disponible en la fecha elegida.
4. Vista "Detalle": semana laboral, calendario local y próximos feriados de una persona.
5. Corrección manual: el usuario puede sobrescribir la semana laboral o el horario
   de cualquier miembro.

### Fuera (explícitamente)

- Cuentas, login, sincronización entre dispositivos (v1 usa almacenamiento local).
- Widgets. Se dejan para la v1.1 — son código nativo separado en cada plataforma
  (Glance / WidgetKit) y no aportan al núcleo.
- Notificaciones push.
- Integración con Google Calendar / Outlook.
- Modo multiplayer o invitaciones.
- Cualquier vista de "calendarios del mundo" desligada del equipo.

### Regla de decisión ante dudas de alcance

Si una funcionalidad no ayuda a responder "¿está disponible?" o "¿qué día elijo?",
queda fuera de la v1.

---

## 3. Arquitectura

### Principio central

> **El cliente nunca calcula disponibilidad.**

Toda la lógica de calendarios, husos, semanas laborales y feriados vive en el backend.
Los clientes piden estados ya resueltos y los pintan.

Motivo: son dos apps nativas. Cualquier lógica que viva en el cliente hay que
escribirla, testearla y corregirla dos veces. Y cualquier corrección de datos de
feriados exigiría publicar una versión nueva en dos tiendas.

### Componentes

```
┌─────────────────┐     ┌─────────────────┐
│  Android nativo │     │   iOS nativo    │
│ Kotlin + Compose│     │ Swift + SwiftUI │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │  HTTPS / JSON
            ┌────────▼────────┐
            │     Backend     │
            │  Toda la lógica │
            └────────┬────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼───┐  ┌─────▼────┐  ┌────▼─────┐
   │  ICU   │  │ JSON de  │  │ Tablas   │
   │(nativo │  │ feriados │  │ husos y  │
   │ de Node│  │ en repo  │  │ semanas  │
   └────────┘  └──────────┘  └──────────┘
```

### Backend — stack

**Node + Hono.** Decidido, no a elección.

Motivo principal: **Node trae ICU completo de fábrica.** `Intl.DateTimeFormat` con
extensiones (`-u-ca-hebrew`, `-u-ca-ethiopic`, `-u-ca-persian`) funciona sin instalar
ni configurar nada. Toda la lógica de conversión de calendarios son pocas líneas.

Hono en vez de Express: más liviano y corre igual en servidor tradicional o serverless.

**Sin base de datos. Sin ORM. Sin autenticación. Sin estado.**
El equipo se guarda en el dispositivo y viaja en cada request.

Deploy: Vercel o Railway. Costo prácticamente nulo.

### Por qué no Supabase (en la v1)

Supabase resuelve Postgres, auth y storage. La v1 no necesita ninguna de las tres.
Usarlo implicaría arrastrar la plataforma entera para terminar usando solo Edge
Functions, que son funciones serverless comunes.

**Reconsiderarlo en la v1.1 si se agregan cuentas y sincronización** (ver sección 12).
Ahí sí es una buena elección y resuelve auth y datos de una.

### Advertencia sobre runtimes alternativos

Si se evalúa Cloudflare Workers, Deno u otro runtime por precio o latencia:
**verificar primero el soporte de `Intl` con calendarios no gregorianos.**
Históricamente estuvo recortado, y es justo la capacidad que sostiene el producto.
Escribir un test que convierta una fecha a los calendarios hebreo, etíope y persa
antes de comprometerse con el runtime.

### Orden de construcción (importante)

1. **Backend completo y congelado**, con tests.
2. Recién después, los dos clientes en paralelo.

No empezar los clientes hasta que el contrato de API esté cerrado. Si el contrato se
mueve mientras hay dos apps en vuelo, el retrabajo se duplica.

---

## 4. Contrato de API

Base: `/v1`. Todas las fechas y horas en ISO 8601. Todas las respuestas en JSON.

### Modelo de miembro (lo guarda el cliente)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Nadia Peretz",
  "city": "Tel Aviv",
  "countryCode": "IL",
  "timezone": "Asia/Jerusalem",
  "overrides": {
    "workDays": null,
    "workStartLocal": null,
    "workEndLocal": null
  },
  "updatedAt": "2026-08-18T14:20:00Z"
}
```

`overrides` en `null` significa "usar el valor inferido del país".

**`id` debe ser UUID v4, nunca autoincremental.** Esto no es opcional: es lo que
permite migrar a una base compartida más adelante con un `INSERT` directo, sin tener
que reasignar claves. Ver sección 12.

`updatedAt` no se usa en la v1, pero se guarda desde el día uno por el mismo motivo.

---

### `GET /v1/locations/search?q=tel+aviv`

Autocompletado de ciudades al agregar un miembro.

```json
{
  "results": [
    {
      "city": "Tel Aviv",
      "region": "Tel Aviv District",
      "country": "Israel",
      "countryCode": "IL",
      "timezone": "Asia/Jerusalem"
    }
  ]
}
```

---

### `POST /v1/availability`

El endpoint principal. El cliente manda su equipo y un instante; recibe estados.

Request:

```json
{
  "at": "2026-08-21T15:42:00Z",
  "members": [
    { "id": "a1", "countryCode": "IL", "timezone": "Asia/Jerusalem", "overrides": null }
  ]
}
```

Response:

```json
{
  "at": "2026-08-21T15:42:00Z",
  "availableCount": 2,
  "totalCount": 6,
  "members": [
    {
      "id": "a1",
      "localTime": "18:42",
      "localDate": "2026-08-21",
      "localWeekday": "friday",
      "utcOffsetMinutes": 180,
      "status": "LOCAL_WEEKEND",
      "statusLabel": "Fin de semana",
      "statusDetail": "Fin de semana en Israel"
    }
  ]
}
```

**Enum `status`** — el cliente mapea esto a color, nada más:

| Valor           | Significado                          | Color        |
|-----------------|--------------------------------------|--------------|
| `AVAILABLE`     | En horario laboral                   | verde        |
| `OFF_HOURS`     | Día laboral, fuera de horario        | gris         |
| `LOCAL_WEEKEND` | Fin de semana local                  | Meridian     |
| `LOCAL_HOLIDAY` | Feriado local                        | Meridian     |
| `UNKNOWN`       | Sin datos para ese país              | gris         |

El backend manda `statusLabel` y `statusDetail` ya redactados y localizados.
**El cliente no arma estos textos.**

---

### `POST /v1/calendar`

Alimenta la vista de mes: qué días tienen conflictos.

Request:

```json
{
  "from": "2026-08-01",
  "to": "2026-08-31",
  "members": [ /* igual que arriba */ ]
}
```

Response:

```json
{
  "days": [
    {
      "date": "2026-08-21",
      "conflictCount": 3,
      "conflicts": [
        { "memberId": "a1", "reason": "LOCAL_WEEKEND", "detail": "Fin de semana en Israel" },
        { "memberId": "b2", "reason": "LOCAL_WEEKEND", "detail": "Fin de semana en Emiratos" },
        { "memberId": "c3", "reason": "LOCAL_HOLIDAY", "detail": "Feriado en Etiopía: Buhe" }
      ]
    }
  ]
}
```

Solo devolver días con `conflictCount > 0`. Los días ausentes están limpios.

---

### `POST /v1/member/detail`

Request:

```json
{
  "member": { /* modelo de miembro */ },
  "at": "2026-08-21T15:42:00Z"
}
```

Response:

```json
{
  "localTime": "18:42",
  "localDateFormatted": "viernes 21 de agosto",
  "utcOffsetMinutes": 180,
  "status": "LOCAL_WEEKEND",
  "statusLabel": "Fin de semana local",
  "workWeek": {
    "daysLabel": "dom a jue",
    "weekendLabel": "vie y sáb",
    "hoursLabel": "9:00 a 18:00"
  },
  "localCalendar": {
    "system": "hebrew",
    "label": "Hebreo",
    "currentYear": "5786",
    "note": "El día empieza al atardecer, no a medianoche."
  },
  "upcomingHolidays": [
    { "name": "Rosh Hashaná", "dateLabel": "11 al 13 de septiembre", "startDate": "2026-09-11" },
    { "name": "Yom Kipur", "dateLabel": "20 de septiembre", "startDate": "2026-09-20" }
  ]
}
```

`localCalendar.note` puede venir en `null`. Solo se muestra si existe.

---

## 5. Datos de calendarios y feriados

### Sistemas de calendario

Usar `Intl.DateTimeFormat` de Node, que ya incluye ICU completo. Ejemplo:

```js
new Intl.DateTimeFormat('es-u-ca-ethiopic', { dateStyle: 'long' })
  .format(new Date('2026-08-17'))
```

Los sistemas disponibles vía CLDR:

```
buddhist, chinese, coptic, dangi, ethiopic, ethioaa, gregory, hebrew,
indian, islamic (+umalqura, civil, tbla, rgsa), japanese, persian, roc
```

Faltantes conocidos, **no implementar en v1**: bikram sambat (Nepal), bengalí,
juliano, baháʼí, amazigh, birmano, tibetano.

Si un país usa un calendario fuera de ICU, devolver `localCalendar: null` y mostrar
solo el gregoriano. No inventar conversiones.

### Feriados — precalculados, no consultados en runtime

**Comprar, no mantener.** Mantener feriados de 50 países a mano es un trabajo de
tiempo completo.

Pero tampoco consultarlos en vivo. El enfoque es:

1. Un script `scripts/build-holidays.ts` que se corre **una vez por año**.
2. Consulta Nager.Date (gratis) o Calendarific (pago, más cobertura).
3. Genera un archivo por país: `data/holidays/IL.json`, `data/holidays/ET.json`, etc.
4. Esos JSON **se commitean al repositorio**.
5. El servidor los lee del disco. Cero llamadas de red en runtime.

Ventajas: sin latencia, sin dependencia externa en producción, sin riesgo de que la
API de terceros se caiga o cambie de precio, y los datos quedan versionados en git —
si un feriado sale mal, se ve en el diff.

El script debe fallar ruidosamente si un país devuelve vacío, para no generar un
JSON silenciosamente incompleto.

### Semanas laborales

Tabla estática en el backend, no inferida:

| Región                                    | Días laborales |
|-------------------------------------------|----------------|
| Mayoría                                   | lun a vie      |
| Israel                                    | dom a jue      |
| Emiratos Árabes Unidos                    | lun a vie*     |
| Arabia Saudita, Kuwait, Qatar, Omán, etc. | dom a jue      |
| Afganistán, Irán                          | sáb a jue      |
| Nepal                                     | dom a vie      |

\* Emiratos cambió en 2022; verificar la vigencia al implementar y dejar la fuente
documentada en el código.

### Trampas conocidas (documentar en el código)

1. **El día no siempre empieza a medianoche.** Los calendarios hebreo e hiyrí
   arrancan al atardecer. Afecta cuándo empieza y termina un feriado.
2. **El calendario islámico tiene cuatro variantes en ICU** y no coinciden entre sí.
   Usar `umalqura` por defecto. El religioso depende de avistamiento lunar real:
   ninguna tabla es definitiva. Documentarlo.
3. **Chino, coreano (dangi) y vietnamita** son el mismo sistema con distinto
   meridiano. Pueden caer en días distintos. No unificarlos.
4. **Los husos horarios cambian.** Usar siempre la base de datos IANA actualizada,
   nunca offsets fijos.

---

## 6. Sistema de diseño — "Sol y Luna"

Paleta idéntica en ambas plataformas. **Los hexadecimales no cambian entre iOS y
Android.** Lo que cambia es cómo se aplican (ver sección 8).

### Tema claro

| Rol                  | Hex       | Nombre    |
|----------------------|-----------|-----------|
| Acción / primario    | `#4436C7` | Vesper    |
| Acento / alerta      | `#E0A03A` | Meridian  |
| Texto principal      | `#171634` | Nocturne  |
| Texto secundario     | `#5B5C74` | Slate     |
| Bordes / divisores   | `#E4E4EC` | Mist      |
| Fondo                | `#F7F7FA` | Paper     |
| Superficie (cards)   | `#FFFFFF` | —         |

### Tema oscuro

| Rol                  | Hex       |
|----------------------|-----------|
| Acción / primario    | `#8B7DFF` |
| Acento / alerta      | `#F0B455` |
| Texto principal      | `#F2F2F7` |
| Texto secundario     | `#9C9DB4` |
| Bordes / divisores   | `#2A2947` |
| Fondo                | `#0F0E1C` |
| Superficie (cards)   | `#1A1930` |

### Colores de estado

| Estado          | Claro (texto) | Claro (fondo) | Oscuro (texto) | Oscuro (fondo) |
|-----------------|---------------|---------------|----------------|----------------|
| `AVAILABLE`     | `#17724E`     | `#E3F3EB`     | `#3DBE8B`      | `#12291F`      |
| `OFF_HOURS`     | `#9C9DB4`     | —             | `#6E6F87`      | —              |
| `LOCAL_WEEKEND` | `#8A5A0B`     | `#FBF0DC`     | `#F0B455`      | `#2A2216`      |
| `LOCAL_HOLIDAY` | `#8A5A0B`     | `#FBF0DC`     | `#F0B455`      | `#2A2216`      |
| `UNKNOWN`       | `#9C9DB4`     | —             | `#6E6F87`      | —              |

### Reglas de color no negociables

1. **Meridian (`#E0A03A`) nunca se usa como texto sobre fondo claro.** Da 2.1:1 y es
   ilegible. Va en puntos, rellenos, bordes e indicadores. Para texto ámbar sobre
   claro, usar `#8A5A0B`.
2. **Botones con relleno `#8B7DFF` (oscuro) llevan texto oscuro `#0E1420`**, no
   blanco. Blanco sobre ese violeta da 3.2:1 y no pasa AA.
3. En tema oscuro la jerarquía se da con **superficies**, no con sombras.
4. Todo par texto/fondo debe superar 4.5:1. Verificar cualquier combinación nueva.

### Los hexadecimales son idénticos en iOS y Android

No hay dos paletas. Lo que cambia por plataforma es cómo se aplican los colores
(sombra vs relleno tonal, ripple vs opacidad, radios), no sus valores.

Dos matices esperados, que **no** son excepciones a la regla:

- **Android deriva tonos adicionales.** Material 3 genera su esquema desde la semilla
  `#4436C7`, así que existirán tonos intermedios que en iOS no tienen equivalente
  nombrado. Es la misma semilla expandida al sistema de roles de Android. Los colores
  de marca y de estado siguen siendo los mismos valores.
- **El vidrio de iOS altera la percepción.** Sobre la barra flotante, un color se
  mezcla con lo que pasa por debajo y puede verse distinto que sobre una tarjeta
  opaca. Esto es esperable y no se corrige con un hex distinto. Es precisamente por
  qué el vidrio va solo en el chrome: en el contenido, donde el color tiene que ser
  fiel y el contraste verificable, todo es opaco.

### Escalas

```
Espaciado: 4, 8, 12, 16, 24, 32, 48
Radios:    iOS → 12-14    Android → 18-20    Píldoras → 999
```

### Tipografía

| Rol       | Tamaño | Peso | Interlineado |
|-----------|--------|------|--------------|
| display   | 46     | 700  | 52           |
| título    | 26     | 700  | 32           |
| encabezado| 19     | 600  | 26           |
| cuerpo    | 15     | 400  | 22           |
| etiqueta  | 13     | 500  | 18           |
| epígrafe  | 11     | 600  | 16 (tracking 1.6, mayúsculas) |

Tipografía del sistema en ambas plataformas: SF Pro en iOS, Roboto en Android.
No incorporar fuentes externas en la v1.

**Números tabulares obligatorios** en horas locales y contadores. Sin eso, los
tiempos bailan al actualizarse cada minuto.

---

## 7. Pantallas

Referencia visual: `mockup-equipos.svg` (tema claro, las tres pantallas).
Para el tratamiento de tema oscuro, ver `mockup-dark.svg` — la paleta ahí es la
anterior, pero **el criterio de superficies, contraste y jerarquía sí aplica.**

### 7.1 Ahora (pantalla inicial)

**Estructura vertical:**

1. Título "Tu equipo"
2. Subtítulo con el contador: "2 de 6 disponibles ahora"
3. Lista de miembros
4. Botón primario "Buscar un horario"
5. Barra de navegación: Equipo · Fechas · Ajustes

**Fila de miembro:**

```
[avatar+badge]  Nombre                      18:42
                Ciudad                Fin de semana
```

- Avatar: círculo con iniciales. Fondo `#E7E5F8` con texto Vesper; si el estado es
  `AVAILABLE`, fondo `#E3F3EB` con texto verde.
- Badge de estado: círculo de 4px con anillo blanco de 2px, abajo a la derecha del avatar.
- Hora local: 17px semibold, tabular, alineada a la derecha.
- Etiqueta de estado: 12px, del color del estado, alineada a la derecha.

**Comportamiento:**

- La hora local se actualiza cada minuto. **Refrescar solo el texto**, no recargar
  la lista entera ni re-consultar la API cada minuto.
- Llamar a `/availability` al abrir la pantalla, al volver del segundo plano y con
  pull-to-refresh.
- Orden de la lista: disponibles primero, después fuera de horario, después fin de
  semana y feriado. Dentro de cada grupo, por nombre.
- Tocar una fila abre el detalle.

**Estado vacío:** "Agregá a tu primer compañero" con un botón. Sin ilustración.

---

### 7.2 Elegir fecha

**Estructura vertical:**

1. Título "Elegir fecha"
2. Cabecera de mes con flechas de navegación
3. Grilla mensual
4. Tarjeta de resumen de la fecha seleccionada
5. Botón "Ver días sin conflictos"
6. Enlace de texto "Agendar igual"

**Grilla:**

- Semana empieza el lunes.
- Días de fin de semana del **usuario** en gris `#9C9DB4`.
- Día con conflictos: punto Meridian de 2.5px de radio, debajo del número.
- Día seleccionado: círculo Vesper relleno, número en blanco y negrita.
- Días pasados atenuados y no seleccionables.

**Tarjeta de resumen** (fondo `#FBF0DC` si hay conflictos, `#E3F3EB` si no):

- Fecha en formato largo, 15px bold.
- Contador: "3 de 6 no disponibles", 13px semibold en `#8A5A0B`.
- Divisor.
- Una línea por conflicto: punto Meridian + `detail` que viene de la API.

**"Agendar igual" tiene que existir.** Si la app solo bloquea, la gente la abandona.
El producto informa, no veta.

**Estado sin conflictos:** la tarjeta pasa a verde y dice "Todo el equipo disponible".

---

### 7.3 Detalle de miembro

**Estructura vertical:**

1. Botón atrás "Equipo"
2. Avatar grande (48px) + nombre + "Ciudad, País · UTC±N"
3. Hora local en display 46px + fecha larga a la derecha
4. Banner de estado (fondo del color del estado)
5. Sección "SEMANA LABORAL" — filas etiqueta/valor con divisores:
   - Días hábiles
   - Fin de semana
   - Horario
   - Calendario local (ej: "Hebreo · 5786") — ocultar si es `null`
6. Sección "PRÓXIMOS FERIADOS" — cards con nombre y fecha
7. Nota al pie en `#9C9DB4` si `localCalendar.note` existe
8. Acción secundaria: "Editar horario" (abre los overrides)

Máximo 3 feriados próximos. Si no hay, ocultar la sección entera.

---

### 7.4 Estados transversales

**Carga:** skeletons con la forma del contenido, no spinners centrados. La lista de
"Ahora" es lo primero que ve el usuario al abrir.

**Error de red:** mostrar los últimos datos cacheados con una franja discreta arriba:
"Datos de hace 12 min · Reintentar". No pantalla de error a pantalla completa si hay
datos viejos utilizables.

**Sin datos de un país:** estado `UNKNOWN`, gris, con la leyenda "Sin datos de
feriados". Nunca inventar ni asumir lunes a viernes silenciosamente.

---

## 8. Convenciones por plataforma

Los colores son idénticos. Esto es lo que **sí** cambia:

### Android

- Jetpack Compose + Material 3.
- Generar el esquema M3 desde semilla `#4436C7` con Material Theme Builder y mapear
  a los roles (`primary`, `onPrimary`, `primaryContainer`, `surfaceContainer*`,
  `outlineVariant`). No hardcodear hex en los Composables.
- **Desactivar dynamic color explícitamente.** Si no, Material You repinta el violeta
  según el fondo de pantalla del usuario.
- Cards: relleno tonal, **sin sombra**.
- Barra inferior: `NavigationBar` de M3, con la píldora indicadora detrás del ícono activo.
- Radios 18-20.
- Feedback táctil: ripple.
- Barra de estado: configurar color y `barStyle` a mano.
- State layers de M3: 8% hover, 12% pressed.

### iOS

- SwiftUI. Nada de UIKit salvo que haga falta.
- Cards: blanco con sombra suave (`y:2, blur:8, opacidad 10%`).
- `TabView` estándar, ítem activo solo teñido, sin píldora.
- Radios 12-14.
- Feedback táctil: opacidad.
- Respetar `Dynamic Type` — nada de tamaños de fuente fijos en puntos absolutos
  donde el sistema espera escalado.
- Safe areas y Dynamic Island manejados por el framework.

#### Liquid Glass (obligatorio, no opcional)

Desde el 28 de abril de 2026 la App Store exige compilar con el SDK de iOS 26 vía
Xcode 26. Al hacerlo, **los componentes estándar de SwiftUI adoptan Liquid Glass
automáticamente**: barra de navegación, `TabView`, botones y sheets. Sin código.

**No usar el flag `UIDesignRequiresCompatibility`.** Permite mantener la UI vieja,
pero Apple lo ignora al compilar con el SDK de iOS 27. Para una app nueva, es deuda
desde el día uno.

**Regla de diseño: vidrio en el chrome, opaco en el contenido.**

| Capa                                    | Tratamiento               |
|-----------------------------------------|---------------------------|
| Tab bar, barra de navegación, sheets    | Liquid Glass (automático) |
| Tarjetas de miembro, banners de estado  | Opaco, sin `.glassEffect()` |
| Grilla del calendario, filas de datos   | Opaco                     |
| Botón flotante de acción, si aparece    | `.glassEffect()`          |

Motivo doble. Estético: es lo que hace Apple — la capa flotante es translúcida, el
contenido no. Y funcional: **el vidrio es translúcido, así que los contrastes fijos
de la sección 6 dejan de estar garantizados** cuando algo se desplaza por detrás.
Mantener el contenido opaco es lo que hace verificable la accesibilidad.

Para elementos custom que sí deban integrarse con el chrome, la API es
`.glassEffect()`, con variantes `.regular` y `.clear`, y modificadores encadenables
`.tint()` e `.interactive()`.

**Pruebas obligatorias antes de publicar:**

1. Con "Reducir transparencia" activado en Ajustes de Accesibilidad.
2. Con "Aumentar contraste" activado.
3. Tema claro y oscuro.
4. Con contenido desplazándose por detrás de la tab bar — verificar que el texto
   de las filas siga legible al pasar bajo el vidrio.

**Nota:** circula una fecha límite de abril de 2027 para adoptar Liquid Glass.
No está en la página de requisitos de Apple. El único piso real es el SDK de iOS 26.
No planificar en base a esa fecha.

**Consecuencia para las capturas de tienda:** generarlas después de compilar con el
SDK nuevo, no antes. Si muestran el chrome viejo, la ficha se ve desactualizada el
primer día.

### Lo que NO se comparte nunca

Widgets (Glance / WidgetKit), extensiones, atajos del sistema. Están fuera de la v1
de todos modos.

---

## 9. Orden de trabajo

**Fase 1 — Backend (terminar antes de tocar clientes)**

0. Verificar `Intl` con calendarios no gregorianos en el runtime elegido.
1. Script `build-holidays.ts` y generación de los JSON por país.
2. Búsqueda de ciudades y resolución de huso horario.
3. Tabla de semanas laborales.
4. Conversión de calendarios vía `Intl`.
5. Los cuatro endpoints, con tests que cubran: Israel (fin de semana vie-sáb),
   Nepal (offset 5:45), Etiopía (calendario propio + feriado), y un país sin datos.
6. Congelar el contrato.

**Fase 2 — Clientes en paralelo**

Mismo orden en ambas plataformas para poder comparar:

1. Capa de red y modelos.
2. Persistencia local del equipo (ver sección 11).
3. Pantalla "Ahora".
4. Alta de miembro con búsqueda de ciudad.
5. Pantalla "Detalle".
6. Pantalla "Elegir fecha".
7. Overrides manuales.
8. Export / import del equipo en JSON.
9. Tema oscuro y verificación de contraste.

**Fase 3 — Pulido**

Estados vacíos, de error y de carga. Accesibilidad. Íconos y capturas de tienda.

---

## 10. Reglas de trabajo para el asistente

1. **No metas lógica de negocio en la UI.** Ni en Composables ni en Views. Si un
   componente necesita decidir si alguien está disponible, el diseño está mal:
   ese dato viene resuelto de la API.

2. **No dupliques lógica entre clientes.** Si te encontrás escribiendo el mismo
   cálculo en Kotlin y en Swift, ese cálculo pertenece al backend. Avisá antes de
   escribirlo dos veces.

3. **No inventes datos de calendarios ni de feriados.** Si un país no está cubierto,
   devolvé `UNKNOWN`. Un dato equivocado es peor que ningún dato: la gente va a
   agendar reuniones basándose en esto.

4. **Verificá las APIs contra la documentación oficial**, especialmente Compose,
   Material 3 y SwiftUI. Fijá versiones en los archivos de build y no las muevas
   sin motivo.

5. **No agregues dependencias sin preguntar.** Cada librería es superficie de
   mantenimiento para una sola persona.

6. **Respetá el alcance de la sección 2.** Si algo parece una buena idea pero no
   está listado, proponelo, no lo implementes.

7. **Cada color nuevo necesita verificación de contraste** contra su fondo, en los
   dos temas, antes de usarse.

8. **Definí vos los límites entre capas, pero pedí confirmación antes de cambiarlos.**
   La arquitectura la decide el humano; la implementación dentro de cada capa es tuya.

---

## 11. Persistencia local

Hay **dos almacenes separados**. No mezclarlos: tienen destinos distintos.

### A. Preferencias de la app

Tema, idioma, horario laboral propio, primer día de la semana.

- Android: `DataStore`
- iOS: `UserDefaults` / `@AppStorage`

**Nunca se sincronizan.** Son propias del dispositivo y no necesitan servidor jamás.

### B. Datos del equipo

La lista de miembros. Este es el único candidato a sincronizarse en el futuro, así
que se guarda con forma de **documento sincronizable** desde el día uno:

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-08-18T14:20:00Z",
  "members": [ /* array de miembros con UUID */ ]
}
```

- Android: archivo JSON o `DataStore` con serialización, **no** SharedPreferences sueltas.
- iOS: archivo JSON en Documents, **no** claves separadas en UserDefaults.

Guardar el documento entero, no campos individuales. Esto es lo que hace que una
migración futura sea copiar un JSON en vez de un refactor.

### Export / import

Compartir y abrir el documento JSON con el share sheet nativo. Resuelve el ~80% de
la necesidad de multi-dispositivo (cambio de teléfono, respaldo) sin backend, auth
ni política de privacidad.

---

## 12. Camino a una base compartida (no construir ahora)

**Decisión: no se construye en la v1.** Se dejan los cimientos, que cuestan casi nada.

### Cuándo valdría la pena

- **Multi-dispositivo** — razón débil. El export/import ya cubre casi todo.
- **Multiplayer** (cada persona declara su propio horario y feriados) — razón fuerte,
  porque mejora la calidad del dato: nadie sabe mejor que Nadia que se toma el jueves.
  Pero rompe el modelo single-player y exige que todos instalen algo.
- **Clientes empresa** — ahí deja de ser opcional, pero eso es otro producto:
  cuentas, roles y facturación.

### Qué hacer ahora para no cerrarse la puerta

1. UUID v4 en todos los IDs de miembro. **Ya está en el contrato, no cambiarlo.**
2. Estado del equipo como documento versionado con `schemaVersion` y `updatedAt`.
3. Mantener las preferencias de app separadas de los datos del equipo.

Con esos tres puntos, agregar Supabase más adelante es trabajo de un fin de semana:
el JSON local se convierte en filas y el backend sin estado gana un cliente de datos.
Sin ellos, es un refactor.

### Señal para reevaluar

Pedidos concretos de usuarios reales pidiendo sincronización. No construirlo antes
de tener esa señal.

---

## 13. Decisiones abiertas

Estas quedaron sin resolver y hay que definirlas antes de la fase 2:

- **Feriados: ¿inferidos por país o declarados por persona?** Propuesta: inferir por
  país y permitir corrección manual por miembro. Inferir escala pero se equivoca;
  declarar es preciso pero nadie mantiene su perfil.
- **Horario laboral por defecto.** Propuesta: 9:00–18:00 local, editable.
- **Idioma.** Propuesta: español e inglés en la v1. Los textos de estado los manda
  el backend, así que agregar idiomas no requiere publicar apps nuevas.
- **Proveedor de feriados.** Nager.Date es gratis pero con cobertura despareja fuera
  de Europa y América. Evaluar Calendarific si falla en los países objetivo. Como los
  datos se precalculan una vez por año, cambiar de proveedor después es barato: solo
  se toca el script, no el servidor.

---

## Resumen de decisiones cerradas

Para no reabrir discusiones ya resueltas:

| Tema                | Decisión                                        |
|---------------------|-------------------------------------------------|
| Plataformas         | Android e iOS nativos, en paralelo              |
| Android             | Kotlin + Compose + Material 3                   |
| iOS                 | Swift + SwiftUI, SDK de iOS 26                  |
| Liquid Glass        | Sí. Vidrio en el chrome, contenido opaco        |
| Framework compartido| Ninguno. Sin KMP, sin Flutter, sin React Native |
| Backend             | Node + Hono, sin estado, sin base de datos      |
| Supabase            | No en la v1. Reevaluar en la v1.1               |
| Feriados            | JSON precalculado y commiteado al repo          |
| Calendarios         | `Intl` de Node (ICU nativo)                     |
| Persistencia        | Local, documento versionado con UUIDs           |
| Modelo              | Single-player. Nadie más instala nada           |
| Widgets             | Fuera de la v1                                  |
| Cuentas / login     | Fuera de la v1                                  |
