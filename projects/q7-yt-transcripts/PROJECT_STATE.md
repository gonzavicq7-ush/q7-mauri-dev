# PROJECT_STATE.md — q7-yt-transcripts

## Proyecto: q7-yt-transcripts
- **Workspace:** Mauri-dev
- **Estado:** operativo
- **Objetivo:** Descargar transcripciones automáticas de videos de YouTube (incluidos unlisted) para uso interno de Cuadrante7
- **Última actualización:** 2026-06-10
- **Responsable/s:** Mauri + Victor

## Stack
- Python 3.11
- youtube-transcript-api 1.2.4
- requests 2.34.2

## Funcionalidades
- [x] Descarga de transcripciones en español o inglés
- [x] Soporte para videos unlisted (por ID)
- [x] Registro histórico en CSV (`registro_historico.csv`)
- [x] Archivos TXT sin timestamps
- [x] Archivos JSON raw opcionales (con timestamps)
- [x] Resumen de ejecución con éxitos/fallidos
- [x] Soporte para URLs completas o solo IDs

## Uso
```bash
python3 download_transcripts.py              # Lee video_ids.txt
python3 download_transcripts.py --id VIDEO_ID # Un solo video
python3 download_transcripts.py --json-output # Con JSON raw
```

## Estructura
```
q7-yt-transcripts/
├── download_transcripts.py      # Script principal
├── video_ids.txt                # Lista de videos a procesar
├── registro_historico.csv       # Registro de todas las ejecuciones
├── transcripciones/             # Output de transcripciones
│   ├── transcripcion_XXX.txt
│   ├── transcripcion_XXX.json   # (opcional)
│   └── resumen_YYYYMMDD.json
└── README.md
```

## Estado actual
- Script creado y probado
- Pendiente: primera ejecución con lista real de videos de Victor

## Próximo paso
1. Victor provee lista de videos unlisted
2. Ejecutar descarga
3. Revisar registro histórico
4. Ajustar si hay fallos