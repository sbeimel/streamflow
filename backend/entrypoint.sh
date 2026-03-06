#!/bin/bash

# StreamFlow Entrypoint
# Starts Flask API with Gunicorn (production server)

set -e

echo "[INFO] Starting StreamFlow Container: $(date)"

# Environment variables with defaults
API_HOST="${API_HOST:-0.0.0.0}"
API_PORT="${API_PORT:-5000}"
DEBUG_MODE="${DEBUG_MODE:-false}"
CONFIG_DIR="${CONFIG_DIR:-/app/data}"
GUNICORN_WORKERS="${GUNICORN_WORKERS:-4}"
GUNICORN_THREADS="${GUNICORN_THREADS:-2}"
GUNICORN_TIMEOUT="${GUNICORN_TIMEOUT:-120}"

# Export environment variables for the Flask application
export API_HOST API_PORT DEBUG_MODE CONFIG_DIR

# Deprecated: Old manual interval approach (kept for backward compatibility warnings)
if [ -n "$INTERVAL_SECONDS" ]; then
    echo "[WARNING] INTERVAL_SECONDS environment variable is deprecated."
    echo "[WARNING] The system now uses automated scheduling via the web API."
    echo "[WARNING] Please configure automation via the web interface or API endpoints."
fi

# Check if configuration files exist, create defaults if needed
echo "[INFO] Checking configuration files..."

# Ensure required directories exist (including the persisted data directory)
mkdir -p csv logs "$CONFIG_DIR"
echo "[INFO] Config directory: $CONFIG_DIR"

# Validate environment setup
if [ ! -f ".env" ]; then
    echo "[INFO] No .env file found. Configuration will be loaded from JSON config files or environment variables."
    
    # Check if required environment variables are set (optional override)
    if [ -n "$DISPATCHARR_BASE_URL" ] && [ -n "$DISPATCHARR_USER" ] && [ -n "$DISPATCHARR_PASS" ]; then
        echo "[INFO] Using environment variables for Dispatcharr configuration (override mode)."
    else
        echo "[INFO] Dispatcharr credentials will be configured via the Setup Wizard."
        echo "[INFO] Configuration is stored in: $CONFIG_DIR/dispatcharr_config.json"
    fi
else
    echo "[INFO] Using .env file for configuration."
fi

# Start StreamFlow service
echo "[INFO] ============================================"
echo "[INFO] Starting StreamFlow Container"
echo "[INFO] ============================================"
echo "[INFO] Flask API: ${API_HOST}:${API_PORT}"
echo "[INFO] Debug mode: ${DEBUG_MODE}"

# Choose server based on DEBUG_MODE
if [ "$DEBUG_MODE" = "true" ]; then
    echo "[INFO] Server: Flask Development Server (single-threaded)"
    echo "[INFO] ============================================"
    echo "[INFO] Access the web interface at http://localhost:${API_PORT}"
    echo "[INFO] API documentation available at http://localhost:${API_PORT}/api/health"
    echo "[INFO] ============================================"
    echo "[INFO] Starting Flask Development Server..."
    
    # Use exec to ensure Flask becomes PID 1 and receives signals properly
    exec python3 web_api.py --host "${API_HOST}" --port "${API_PORT}" --debug
else
    echo "[INFO] Server: Gunicorn (production)"
    echo "[INFO] Workers: ${GUNICORN_WORKERS}"
    echo "[INFO] Threads per worker: ${GUNICORN_THREADS}"
    echo "[INFO] Timeout: ${GUNICORN_TIMEOUT}s"
    echo "[INFO] ============================================"
    echo "[INFO] Access the web interface at http://localhost:${API_PORT}"
    echo "[INFO] API documentation available at http://localhost:${API_PORT}/api/health"
    echo "[INFO] ============================================"
    echo "[INFO] Starting Gunicorn..."
    
    # Use exec to ensure Gunicorn becomes PID 1 and receives signals properly
    exec gunicorn \
        --bind "${API_HOST}:${API_PORT}" \
        --workers "${GUNICORN_WORKERS}" \
        --threads "${GUNICORN_THREADS}" \
        --timeout "${GUNICORN_TIMEOUT}" \
        --access-logfile - \
        --error-logfile - \
        --log-level info \
        --worker-class gthread \
        "web_api:app"
fi
