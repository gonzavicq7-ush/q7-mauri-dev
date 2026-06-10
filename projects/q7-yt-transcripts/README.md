# q7-yt-transcripts

Herramienta interna de Cuadrante7 para descargar transcripciones automáticas de videos de YouTube (incluidos unlisted).

## Uso

### 1. Preparar lista de videos

Crear archivo `video_ids.txt` con los IDs o URLs:

```
# Comentarios con #
dQw4w9WgXcQ
https://www.youtube.com/watch?v=abc123
https://youtu.be/xyz789
```

### 2. Descargar transcripciones

```bash
# Todos los videos del archivo
python3 download_transcripts.py

# Archivo personalizado
python3 download_transcripts.py --input mis_videos.txt

# Un solo video
python3 download_transcripts.py --id VIDEO_ID

# Con archivos JSON raw también
python3 download_transcripts.py --json-output
```

### 3. Revisar resultados

- **Transcripciones**: carpeta `transcripciones/`
- **Registro histórico**: `registro_historico.csv`
- **Resumen JSON**: `transcripciones/resumen_YYYYMMDD_HHMMSS.json`

## Registro histórico

El archivo CSV `registro_historico.csv` contiene:

| Columna | Descripción |
|---------|-------------|
| `fecha_hora` | Timestamp de ejecución |
| `video_id` | ID del video de YouTube |
| `estado` | OK o FALLIDO |
| `idioma` | Idioma detectado (es, en, etc.) |
| `lineas` | Cantidad de líneas de transcripción |
| `archivo` | Ruta del archivo generado |
| `error` | Mensaje de error (si falló) |

## Dependencias

- `youtube-transcript-api` (instalado con pip)
- Python 3.11+

## Stack

| Componente | Versión |
|------------|---------|
| Python | 3.11 |
| youtube-transcript-api | 1.2.4 |
| requests | 2.34.2 |

## Notas

- Los videos **unlisted** funcionan siempre que tengan transcripción automática generada por YouTube
- El script intenta primero `es` (español), luego `en` (inglés)
- Si un video no tiene transcripción disponible, se marca como FALLIDO en el registro
- Los archivos TXT son texto plano sin timestamps
- Los archivos JSON (opcional) contienen los datos raw con timestamps