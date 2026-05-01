# q7-audio2md

Transcriptor de audio local basado en Whisper.cpp — sin cloud, sin costos de API.

## Estado

✅ **Funcional y estable.** Conversión robusta de `.m4a` implementada con múltiples estrategias de fallback.

## Formatos soportados

| Formato | Extensión | Notas |
|---------|-----------|-------|
| WAV | `.wav` | Soportado nativamente por Whisper.cpp |
| MP3 | `.mp3` | Convertido via ffmpeg |
| FLAC | `.flac` | Convertido via ffmpeg |
| OGG | `.ogg` | Soportado nativamente |
| Opus | `.opus` | Convertido via ffmpeg |
| AAC | `.aac` | Convertido via ffmpeg |
| AIFF | `.aiff` | Convertido via ffmpeg |
| ALAC | `.alac` | Convertido via ffmpeg |
| M4A | `.m4a` | ✅ **Conversión robusta** — ver sección abajo |
| MP4 | `.mp4` | Convertido via ffmpeg |

## Conversión robusta de .m4a

El sistema implementa **6 estrategias de fallback** para manejar archivos `.m4a` problemáticos:

1. **ffmpeg normal** — conversión estándar
2. **Ignorar streams desconocidos** — `-ignore_unknown_streams -dn -sn -vn`
3. **Ignorar errores de decodificación** — `-fflags +discardcorrupt -err_detect ignore_err`
4. **Extracción raw AAC** — extraer stream AAC, luego convertir a WAV
5. **Forzar formato de entrada** — `-f mp4` para headers problemáticos
6. **Map audio exclusivo** — `-map 0:a:0` con flags de descarte

Todas las estrategias producen WAV mono 16kHz validado (header RIFF/WAVE).

## Setup

```bash
npm install
npm run dev
```

El servidor corre en `http://127.0.0.1:3030`.

## API

- `GET /api/jobs` — Lista de jobs
- `GET /api/formats` — Formatos soportados
- `POST /api/upload` — Subir audio(s)
- `POST /api/folder` — Registrar carpeta
- `POST /api/process` — Procesar job
- `POST /api/delete` — Eliminar job

## Herramientas incluidas

- `tools/ffmpeg` — Conversión de formatos
- `tools/whisper.cpp/build/bin/whisper-cli` — Motor de transcripción
- `tools/whisper.cpp/ggml-small.bin` — Modelo en español

## Funcionalidades implementadas

- [x] Subida de archivos individuales o múltiples
- [x] Registro de carpeta completa de audios
- [x] Conversión robusta de `.m4a` (AAC/ALAC) con 6 estrategias de fallback
- [x] Conversión de múltiples formatos (MP3, FLAC, OGG, OPUS, AAC, AIFF, ALAC, MP4)
- [x] Transcripción con Whisper.cpp modelo small
- [x] Exportación a `.txt` y `.md`
- [x] UI web embebida (sin dependencias frontend)
- [x] Sistema de jobs con estados (en cola, convirtiendo, transcribiendo, exportando, completado, error)
- [x] Logging persistente en `data/logs/q7-audio2md.log`
- [x] Validación de WAV resultante (header RIFF/WAVE)
- [x] Manejo de errores con mensajes claros al usuario

---

## 🧪 Caso documentado: Archivos `.m4a` corruptos

### Diagnóstico (2026-04-23)

Se descubrió un **edge case** con archivos `.m4a` generados por ciertas apps de grabación (ej. URecorder de Android) que producen **containers MP4 corruptos**.

#### Síntomas

- ffmpeg detecta metadatos del archivo (duración, bitrate, codec AAC)
- Pero **no puede leer ningún paquete de audio**: `0 packets read (0 bytes)`
- La conversión produce WAV vacío (solo header, 78 bytes)
- Whisper devuelve: *"(sin texto reconocido)"*

#### Causa raíz

El container MP4 tiene el **átomo `moov` (índice) al final del archivo** en vez de al principio, y además los **frames AAC dentro del `mdat` tienen errores de bit** que hacen imposible la decodificación.

```
Archivo corrupto:
┌─────────┬─────────┬──────────────────┬──────────┐
│  ftyp   │  free   │      mdat        │  moov    │
│ 24 bytes│ 3192 B  │   217 MB audio   │  1.1 MB  │
│         │         │  (índice ausente)│ (al final)│
└─────────┴─────────┴──────────────────┴──────────┘

Archivo correcto:
┌─────────┬──────────┬──────────────────┐
│  ftyp   │  moov    │      mdat        │
│ 24 bytes│  índice  │   audio data     │
└─────────┴──────────┴──────────────────┘
```

#### Intento de reparación

Se intentaron las siguientes técnicas (todas fallaron):

| Técnica | Resultado |
|---------|-----------|
| Reconstrucción de container (mover moov al inicio) | ✅ Container reparado |
| Decodificación AAC con ffmpeg | ❌ Error rate 99.88% |
| Extracción raw de frames AAC | ❌ Frames corruptos |
| `probesize`/`analyzeduration` aumentados | ❌ Sin efecto |
| `discardcorrupt` + `ignore_err` | ❌ Sin efecto |
| Re-encapsulación con `-movflags faststart` | ❌ Segfault |

#### Conclusión

> **Los datos de audio dentro del `mdat` están físicamente corruptos.** No es un problema de container ni de codec — es corrupción de bits en el stream de audio mismo. ffmpeg no puede recuperarlos.

#### ✅ Workaround validado

**Re-exportar el archivo desde una app que sí pueda leerlo** (en este caso, Switch by NCH Software) a formato **MP3 o WAV**, y luego procesarlo con q7-audio2md.

| Origen | Estado | Solución |
|--------|--------|----------|
| URecorder `.m4a` | ❌ Corrupto | Re-exportar desde Switch a MP3 |
| Switch `.mp3` | ✅ Sano | Transcribe correctamente |

#### Recomendación

Si vas a usar apps de grabación de Android como URecorder, configurá la app para exportar directamente a **MP3** o **WAV** en vez de `.m4a`, o re-exportá desde una herramienta como Switch antes de procesar.

---

## Troubleshooting

| Síntoma | Posible causa | Solución |
|---------|-------------|----------|
| "(sin texto reconocido)" | Archivo de audio corrupto | Re-exportar desde otra app |
| WAV de 78 bytes | Container MP4/M4A corrupto | Usar MP3/WAV de origen |
| "Error rate exceeds maximum" | Frames AAC dañados | Re-encodificar a MP3 |
| ffmpeg segfault | Container severamente corrupto | Re-exportar el archivo |

## Próximos pasos opcionales

- Agregar UI de drag-and-drop
- Implementar progreso en tiempo real (WebSocket/SSE)
- Dockerizar
- Agregar soporte para archivos corruptos via `faad2` (decoder AAC alternativo más tolerante)

## Historial de versiones

| Versión | Fecha | Cambios |
|---------|-------|---------|
| v1.1 | 2026-04-23 | Conversión robusta `.m4a` con 6 estrategias de fallback, repo git propio, documentación de edge cases |
| v1.0 | 2026-04-20 | Versión inicial funcional