#!/bin/bash
set -e
cd "$(dirname "$0")"

export PATH="$HOME/.local/bin:$PATH"

# Ensure uv is installed
if ! command -v uv &> /dev/null; then
    echo "Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# Create venv and install deps if missing
if [ ! -d ".venv" ]; then
    uv venv
fi
uv pip install -r requirements.txt

export PYTHONPATH="${PYTHONPATH}:$(pwd)"

echo "🚀 Starting Q7 Obras on http://localhost:8000"
exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
