# Almanaq

App de disponibilidad para equipos distribuidos. Responde quién del equipo está
realmente disponible ahora, teniendo en cuenta el calendario local de cada persona:
fines de semana que no son sábado y domingo, feriados nacionales y festividades que
se rigen por calendarios no gregorianos.

Monorepo con tres piezas: backend en Node, cliente Android nativo, cliente iOS nativo.

## Antes de escribir código

Leé `PLAN.md`. Contiene alcance, arquitectura, contrato de API, sistema de diseño y
especificación de pantallas. **No empieces sin haberlo leído entero.**

`SETUP.md` tiene la estructura de carpetas, el bootstrap de cada pieza y el orden de
la primera semana.

Los valores de color canónicos están en `design/tokens.json`. No copies hexadecimales
desde el markdown ni desde los SVG: leelos de ahí.

Referencias visuales en `design/`:

| Archivo                       | Qué muestra                                    |
|-------------------------------|------------------------------------------------|
| `mockup-equipos.svg`          | Las tres pantallas, tema claro                 |
| `mockup-plataformas-v2.svg`   | iOS y Android, claro y oscuro, con Liquid Glass|
| `paleta-sol-luna.svg`         | Paleta completa y codificación de estados      |

## Reglas que no se cruzan

1. **La lógica de negocio vive en el backend.** El cliente nunca calcula
   disponibilidad, husos, feriados ni conversiones de calendario. Pide y pinta.

2. **Si te encontrás escribiendo el mismo cálculo en Kotlin y en Swift, pará.**
   Ese cálculo pertenece al backend. Avisá antes de duplicarlo.

3. **No inventes datos de calendarios ni de feriados.** País sin cobertura devuelve
   `UNKNOWN`. Un dato equivocado es peor que ningún dato: la gente agenda reuniones
   con esto.

4. **Los IDs de miembro son UUID v4.** Nunca autoincrementales. Esto habilita una
   migración futura a base compartida (ver sección 12 del plan).

5. **No agregues dependencias sin preguntar.** Una sola persona mantiene esto.

6. **Respetá el alcance de la sección 2 del plan.** Si algo parece buena idea pero
   no está listado, proponelo, no lo implementes.

7. **Cada combinación de color nueva se verifica a 4.5:1** contra su fondo, en los
   dos temas, antes de usarse.

8. **La arquitectura la decide el humano.** Podés proponer cambios de estructura;
   no los apliques sin confirmación.

## Stack (cerrado, no reabrir)

| Área          | Decisión                                          |
|---------------|---------------------------------------------------|
| Backend       | Node + Hono. Sin base de datos, sin auth, sin estado |
| Android       | Kotlin + Jetpack Compose + Material 3             |
| iOS           | Swift + SwiftUI, SDK de iOS 26, Liquid Glass      |
| Compartido    | Nada. Sin KMP, sin Flutter, sin React Native      |
| Feriados      | JSON precalculado y commiteado, no API en runtime |
| Calendarios   | `Intl` de Node (ICU nativo)                       |
| Persistencia  | Local. Documento versionado con UUIDs             |

## Orden de trabajo

**El backend se termina y se congela antes de tocar cualquier cliente.** Con dos
apps en vuelo, un contrato que se mueve duplica el retrabajo.

Después, los dos clientes en paralelo siguiendo el mismo orden de pantallas, para
poder compararlos.

## Estado del proyecto

**El proyecto se está creando de cero.** Si una carpeta o comando de este documento
todavía no existe, es esperable. Ver `SETUP.md` para el orden de arranque.

Los proyectos de Android (Gradle) e iOS (`.xcodeproj`) **los crea el humano** con los
asistentes de Android Studio y Xcode. No intentes generarlos: son estructuras con
decenas de archivos interdependientes que se reconstruyen mal a mano. El backend sí
se crea entero desde acá.

## Comandos

Disponibles una vez creado el backend (ver `SETUP.md` sección 2):

```
npm run dev             # servidor local
npm test                # tests
npm run build:holidays  # regenera data/holidays/*.json (1 vez por año)
```

## Convenciones

- Mensajes de commit en español, imperativo: "agrega endpoint de disponibilidad".
- Los textos visibles al usuario los devuelve el backend ya redactados
  (`statusLabel`, `statusDetail`). El cliente no los arma.
- Comentarios en el código en español.
- Documentar en el código toda fuente de datos externa (semanas laborales, feriados)
  con enlace y fecha de verificación.
