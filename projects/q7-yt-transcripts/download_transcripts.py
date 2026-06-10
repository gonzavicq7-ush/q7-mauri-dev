#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
q7-yt-transcripts — Descarga transcripciones de videos de YouTube (incluidos unlisted).

Uso:
    python3 download_transcripts.py              # Lee video_ids.txt
    python3 download_transcripts.py --input ids.txt
    python3 download_transcripts.py --id abc123  # Un solo video
    python3 download_transcripts.py --json-output # Guarda también JSON raw
"""

import os
import sys
import csv
import json
import argparse
from datetime import datetime
from pathlib import Path

# youtube_transcript_api está en --user, asegurar que esté en path
sys.path.insert(0, os.path.expanduser("~/.local/lib/python3.11/site-packages"))

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter, JSONFormatter

# ── Config ─────────────────────────────────────────
DEFAULT_INPUT_FILE = "video_ids.txt"
OUTPUT_DIR = Path("transcripciones")
REGISTRO_FILE = Path("registro_historico.csv")
LANGUAGES = ['es', 'en']  # Prioridad: español, luego inglés


def leer_video_ids(filepath: str) -> list:
    """Lee lista de video IDs desde archivo de texto."""
    ids = []
    path = Path(filepath)
    if not path.exists():
        print(f"⚠️  Archivo no encontrado: {filepath}")
        return ids
    
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                # Extraer ID si viene como URL completa
                if 'youtube.com' in line or 'youtu.be' in line:
                    vid = extraer_id_de_url(line)
                    if vid:
                        ids.append(vid)
                else:
                    ids.append(line)
    return ids


def extraer_id_de_url(url: str) -> str:
    """Extrae video ID de URL de YouTube."""
    from urllib.parse import urlparse, parse_qs
    parsed = urlparse(url)
    if parsed.hostname in ('youtube.com', 'www.youtube.com'):
        return parse_qs(parsed.query).get('v', [None])[0]
    if parsed.hostname == 'youtu.be':
        return parsed.path.lstrip('/')
    return None


def descargar_transcripcion(video_id: str, guardar_json: bool = False, registro_file: Path = None) -> dict:
    """
    Descarga transcripción de un video.
    
    Retorna dict con:
        success: bool
        video_id: str
        filename: str o None
        json_filename: str o None
        language: str o None
        lines_count: int
        error: str o None
    """
    resultado = {
        'success': False,
        'video_id': video_id,
        'filename': None,
        'json_filename': None,
        'language': None,
        'lines_count': 0,
        'error': None,
        'timestamp': datetime.now().isoformat()
    }
    
    try:
        # Obtener transcripción (API v1.2.4+ requiere instancia)
        api = YouTubeTranscriptApi()
        transcript_obj = api.fetch(video_id, languages=LANGUAGES)
        
        # Convertir objeto TranscriptList a lista de dicts
        transcript_list = []
        for segment in transcript_obj:
            transcript_list.append({
                'text': segment.text,
                'start': segment.start,
                'duration': segment.duration,
            })
        
        resultado['language'] = LANGUAGES[0]  # El primero que funcionó
        resultado['lines_count'] = len(transcript_list)
        
        # Crear output dir
        OUTPUT_DIR.mkdir(exist_ok=True)
        
        # Guardar TXT (texto plano)
        texto_plano = "\n".join([seg['text'] for seg in transcript_list])
        filename = OUTPUT_DIR / f"transcripcion_{video_id}.txt"
        with open(filename, "w", encoding="utf-8") as f:
            f.write(texto_plano)
        resultado['filename'] = str(filename)
        
        # Guardar JSON raw (opcional)
        if guardar_json:
            json_filename = OUTPUT_DIR / f"transcripcion_{video_id}.json"
            with open(json_filename, "w", encoding="utf-8") as f:
                json.dump(transcript_list, f, indent=2, ensure_ascii=False)
            resultado['json_filename'] = str(json_filename)
        
        resultado['success'] = True
        print(f"✓ {video_id} — Guardado: {filename} ({len(transcript_list)} líneas, {resultado['language']})")
        
    except Exception as e:
        resultado['error'] = str(e)
        print(f"✗ {video_id} — ERROR: {str(e)}")
    
    return resultado


def detectar_idioma(transcript: list) -> str:
    """Detecta idioma predominante de la transcripción."""
    if not transcript:
        return "unknown"
    
    # El API retorna el idioma en cada segmento
    langs = {}
    for segment in transcript:
        lang = segment.get('language', 'unknown')
        langs[lang] = langs.get(lang, 0) + 1
    
    if langs:
        return max(langs, key=langs.get)
    return "unknown"


def inicializar_registro():
    """Crea archivo CSV de registro si no existe."""
    if not REGISTRO_FILE.exists():
        with open(REGISTRO_FILE, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                'fecha_hora', 'video_id', 'estado', 'idioma', 
                'lineas', 'archivo', 'error'
            ])


def guardar_en_registro(resultado: dict):
    """Agrega una entrada al registro histórico CSV."""
    inicializar_registro()
    
    with open(REGISTRO_FILE, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            resultado['timestamp'],
            resultado['video_id'],
            'OK' if resultado['success'] else 'FALLIDO',
            resultado['language'] or '',
            resultado['lines_count'],
            resultado['filename'] or '',
            resultado['error'] or ''
        ])


def mostrar_resumen(resultados: list):
    """Muestra resumen final de la ejecución."""
    total = len(resultados)
    ok = sum(1 for r in resultados if r['success'])
    fallidos = total - ok
    
    print("\n" + "="*60)
    print("📊 RESUMEN DE DESCARGA")
    print("="*60)
    print(f"   Total videos procesados: {total}")
    print(f"   ✅ Exitosos: {ok}")
    print(f"   ❌ Fallidos: {fallidos}")
    print(f"\n   Registro guardado en: {REGISTRO_FILE}")
    print(f"   Transcripciones en: {OUTPUT_DIR}/")
    print("="*60)
    
    if fallidos > 0:
        print("\n⚠️  Videos que fallaron:")
        for r in resultados:
            if not r['success']:
                print(f"   - {r['video_id']}: {r['error']}")
    
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Descarga transcripciones de videos de YouTube"
    )
    parser.add_argument(
        '--input', '-i',
        default=DEFAULT_INPUT_FILE,
        help=f"Archivo con lista de video IDs (default: {DEFAULT_INPUT_FILE})"
    )
    parser.add_argument(
        '--id',
        help="Descargar un solo video ID"
    )
    parser.add_argument(
        '--json-output', '-j',
        action='store_true',
        help="Guardar también archivos JSON raw"
    )
    
    args = parser.parse_args()
    
    # Obtener lista de IDs
    if args.id:
        video_ids = [args.id]
    else:
        video_ids = leer_video_ids(args.input)
    
    if not video_ids:
        print("❌ No se encontraron video IDs para procesar.")
        print(f"   Creá el archivo '{args.input}' con un ID por línea.")
        print("   Formatos soportados:")
        print("      dQw4w9WgXcQ")
        print("      https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        sys.exit(1)
    
    print(f"📥 Procesando {len(video_ids)} video(s)...\n")
    
    # Descargar cada uno
    resultados = []
    for vid in video_ids:
        res = descargar_transcripcion(vid, guardar_json=args.json_output)
        guardar_en_registro(res)
        resultados.append(res)
    
    # Mostrar resumen
    mostrar_resumen(resultados)
    
    # Guardar resumen JSON
    resumen_file = OUTPUT_DIR / f"resumen_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(resumen_file, 'w', encoding='utf-8') as f:
        json.dump(resultados, f, indent=2, ensure_ascii=False)
    print(f"📄 Resumen JSON guardado: {resumen_file}")


if __name__ == "__main__":
    main()