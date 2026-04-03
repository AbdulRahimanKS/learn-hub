#!/usr/bin/env bash
# Start Django, Celery worker, and Vite dev server together.
# Usage: ./dev.sh   (from repo root; Ctrl+C stops all three)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$REPO_ROOT/backend/elearn-backend"
FRONTEND="$REPO_ROOT/frontend"

if [[ ! -d "$BACKEND" || ! -d "$FRONTEND" ]]; then
  echo "Expected backend at $BACKEND and frontend at $FRONTEND" >&2
  exit 1
fi

# Use the project venv Python when present (avoids system python without Django).
# Override: VENV_PYTHON=/path/to/python ./dev.sh
PY=""
if [[ -n "${VENV_PYTHON:-}" && -x "$VENV_PYTHON" ]]; then
  PY="$VENV_PYTHON"
fi
if [[ -z "$PY" ]]; then
  # Common layout: venv next to elearn-backend (backend/venv), not inside it
  for candidate in \
    "$REPO_ROOT/backend/venv/bin/python3" \
    "$REPO_ROOT/backend/venv/bin/python" \
    "$BACKEND/.venv/bin/python3" \
    "$BACKEND/.venv/bin/python" \
    "$BACKEND/venv/bin/python3" \
    "$BACKEND/venv/bin/python" \
    "$REPO_ROOT/.venv/bin/python3" \
    "$REPO_ROOT/.venv/bin/python"; do
    if [[ -x "$candidate" ]]; then
      PY="$candidate"
      break
    fi
  done
fi
if [[ -z "$PY" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    PY="$(command -v python3)"
  elif command -v python >/dev/null 2>&1; then
    PY="$(command -v python)"
  fi
fi
if [[ -z "$PY" ]]; then
  echo "No Python found. Use backend/venv or backend/elearn-backend/.venv, or: VENV_PYTHON=/path/to/python ./dev.sh" >&2
  exit 1
fi

if ! "$PY" -c "import django" 2>/dev/null; then
  echo "Django not found for: $PY" >&2
  echo "Install backend deps in that environment, e.g.:" >&2
  echo "  cd \"$BACKEND\" && ../venv/bin/python -m pip install -r requirements.txt" >&2
  exit 1
fi

PIDS=()
kill_children() {
  local pid
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}

trap 'echo ""; echo "Stopping…"; kill_children; exit 130' INT TERM

echo "Using Python: $PY"
echo "→ Django  : (manage.py runserver 0.0.0.0:8000)"
(cd "$BACKEND" && exec "$PY" manage.py runserver 0.0.0.0:8000) &
PIDS+=($!)

echo "→ Celery  : $PY -m celery -A config worker -l info --concurrency=2"
(cd "$BACKEND" && exec "$PY" -m celery -A config worker -l info --concurrency=2) &
PIDS+=($!)

echo "→ Vite    : npm run dev (frontend)"
(cd "$FRONTEND" && exec npm run dev) &
PIDS+=($!)

echo ""
echo "All services started. Press Ctrl+C to stop."
wait
