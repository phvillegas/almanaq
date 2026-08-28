# Almanaq

App de disponibilidad para equipos distribuidos. Responde quién del equipo está
realmente disponible ahora, teniendo en cuenta el calendario local de cada persona:
fines de semana que no son sábado y domingo, feriados nacionales y festividades que se
rigen por calendarios no gregorianos.

El caso que define el producto: es viernes al mediodía en Buenos Aires, parece un día
laboral normal, y la mitad del equipo está de fin de semana o de feriado.

## Estado

| Pieza    | Estado                                                        |
|----------|---------------------------------------------------------------|
| Backend  | Los cuatro endpoints andando, con tests. Contrato sin congelar |
| Android  | Sin empezar                                                    |
| iOS      | Sin empezar                                                    |

Los clientes no arrancan hasta que el contrato esté congelado: con dos apps en vuelo,
un contrato que se mueve duplica el retrabajo.

## Estructura

```
almanaq/
├── CLAUDE.md     instrucciones permanentes para el asistente de código
├── PLAN.md       alcance, arquitectura, contrato de API y sistema de diseño
├── SETUP.md      puesta en marcha y orden de arranque
├── design/       tokens de color y mockups
├── backend/      Node + Hono + TypeScript
├── android/      Kotlin + Compose (por crear desde Android Studio)
└── ios/          Swift + SwiftUI (por crear desde Xcode)
```

## Backend

Requiere Node 22 o superior. Toda la lógica de negocio vive acá: los clientes piden
estados ya resueltos y los pintan.

```bash
cd backend
npm install
npm run dev      # servidor en http://localhost:3000
npm test         # 64 tests
npm run build    # compila a dist/
```

### Endpoints

Base `/v1`. Sin base de datos, sin autenticación y sin estado: el equipo vive en el
dispositivo y viaja en cada request.

| Endpoint                       | Qué hace                                          |
|--------------------------------|---------------------------------------------------|
| `GET  /v1/locations/search?q=` | Autocompletado de ciudades al agregar un miembro   |
| `POST /v1/availability`        | Estado de cada miembro en un instante              |
| `POST /v1/calendar`            | Días con conflictos en un rango de fechas          |
| `POST /v1/member/detail`       | Semana laboral, calendario local y feriados        |

El detalle de cada request y response está en la sección 4 de `PLAN.md`.

```bash
curl -s "http://localhost:3000/v1/locations/search?q=tel+aviv"

curl -s -X POST http://localhost:3000/v1/availability \
  -H 'content-type: application/json' \
  -d '{"at":"2026-08-21T15:42:00Z","members":[
        {"id":"a1","countryCode":"IL","timezone":"Asia/Jerusalem"}]}'
```

### Estados

El backend devuelve el enum ya resuelto y los textos ya redactados. El cliente mapea
el estado a un color y nada más.

| Estado          | Significado                    |
|-----------------|--------------------------------|
| `AVAILABLE`     | En horario laboral             |
| `OFF_HOURS`     | Día laboral, fuera de horario  |
| `LOCAL_WEEKEND` | Fin de semana local            |
| `LOCAL_HOLIDAY` | Feriado local                  |
| `UNKNOWN`       | Sin datos suficientes          |

**La cobertura de feriados es el único portón hacia `AVAILABLE`.** Sin datos de
feriados de un país, nunca se afirma que alguien está trabajando: se devuelve
`UNKNOWN`. Un dato equivocado es peor que ningún dato, porque la gente agenda
reuniones con esto.

## Datos

Todo se precalcula y se commitea. En runtime no hay ninguna llamada de red: sin
latencia, sin depender de que un tercero siga en pie, y con los datos versionados en
git, donde un feriado mal cargado se ve en el diff.

```bash
npm run build:holidays    # 1 vez por año
npm run build:locations   # cuando cambie el volcado de GeoNames
```

| Dato       | Fuente                              | Cobertura actual        |
|------------|-------------------------------------|-------------------------|
| Feriados   | [Nager.Date](https://date.nager.at) | 57 países               |
| Ciudades   | [GeoNames](https://geonames.org) `cities15000`, CC BY 4.0 | 34.079 ciudades, 210 países |
| Calendarios| ICU nativo de Node (`Intl`)         | hebreo, etíope, persa, hiyrí, budista, saka, japonés |
| Semanas laborales | Tabla estática con fuente por fila | 20 países + regla mayoritaria |

### Limitación conocida del proveedor de feriados

Nager.Date lista 204 países pero no cubre ninguno de estos:

```
IL SA QA KW OM JO PS MV AE AF IR NP BN TH IN MY PK LB
```

Es casi exactamente el conjunto de países con semana laboral no estándar, que es el
problema que Almanaq existe para resolver. Sus miembros quedan en `UNKNOWN` los días
hábiles; los fines de semana sí se resuelven bien, porque salen de la tabla propia.

Cambiar de proveedor es barato: se toca `backend/scripts/build-holidays.ts` y nada
más. Ver la decisión abierta en la sección 13 de `PLAN.md`.

## Diseño

Los valores canónicos de color están en `design/tokens.json`, que es la única fuente
de verdad. Los hexadecimales son idénticos en iOS y Android; lo que cambia es cómo se
aplican. Toda combinación de texto y fondo tiene que superar 4.5:1 en los dos temas.

## Documentos

- `PLAN.md` — alcance, arquitectura, contrato de API, sistema de diseño y pantallas.
- `SETUP.md` — estructura de carpetas y bootstrap de cada pieza.
- `CLAUDE.md` — reglas permanentes de trabajo.
