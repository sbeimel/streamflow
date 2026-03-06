#!/bin/bash
# Quick Wins Performance Optimizations - Linux/Mac Installation Script
# This script applies the frontend polling fix for massive performance improvement

set -e

echo "========================================"
echo "Quick Wins Performance Optimizations"
echo "========================================"
echo ""
echo "This script will apply:"
echo "1. Frontend M3U Polling Fix (200x less network traffic)"
echo ""
echo "Backend optimizations (FFmpeg duration, retries, global limit)"
echo "must be configured manually in the Web UI."
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

echo ""
echo "[1/4] Checking if patch file exists..."
if [ ! -f "streamflow_quick_wins_optimizations.patch" ]; then
    echo "ERROR: Patch file not found!"
    echo "Please ensure streamflow_quick_wins_optimizations.patch is in the current directory."
    exit 1
fi
echo "OK: Patch file found"

echo ""
echo "[2/4] Applying frontend polling fix..."
if ! git apply streamflow_quick_wins_optimizations.patch; then
    echo "ERROR: Failed to apply patch!"
    echo "This might happen if:"
    echo "- Git is not installed"
    echo "- The patch was already applied"
    echo "- The file was modified manually"
    echo ""
    echo "You can apply the changes manually by editing:"
    echo "frontend/src/pages/StreamChecker.jsx"
    exit 1
fi
echo "OK: Patch applied successfully"

echo ""
echo "[3/4] Stopping containers..."
docker-compose down || echo "WARNING: Failed to stop containers, continuing anyway..."

echo ""
echo "[4/4] Rebuilding and starting containers..."
if ! docker-compose build; then
    echo "ERROR: Failed to build containers!"
    exit 1
fi

if ! docker-compose up -d; then
    echo "ERROR: Failed to start containers!"
    exit 1
fi

echo ""
echo "========================================"
echo "Installation Complete!"
echo "========================================"
echo ""
echo "Frontend polling fix has been applied."
echo ""
echo "NEXT STEPS:"
echo "1. Open Web UI: http://ricotv.goip.de:5002"
echo "2. Go to: Stream Checker -> Configuration"
echo "3. Apply these settings:"
echo ""
echo "   Stream Analysis:"
echo "   - FFmpeg Duration: 8 (instead of 30)"
echo "   - Retries: 0 (instead of 1)"
echo "   - Retry Delay: 5 (instead of 10)"
echo "   - Stream Startup Buffer: 5 (instead of 10)"
echo ""
echo "   Concurrent Checking:"
echo "   - Global Limit: 60 (instead of 35)"
echo "   - Stagger Delay: 0.5 (instead of 1.0)"
echo ""
echo "   Multi-Channel:"
echo "   - Max Concurrent Channels: 20 (instead of 10)"
echo ""
echo "4. Save configuration"
echo "5. Test with Global Action"
echo ""
echo "Expected speedup: Up to 48x faster!"
echo ""
echo "For more details, see: QUICK_WINS_OPTIMIZATIONS_README.md"
echo ""
