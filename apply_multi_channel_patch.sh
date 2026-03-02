#!/bin/bash

# Multi-Channel Parallel Processing Patch Application Script
# Applies only the Multi-Channel Processing feature to StreamFlow

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_FILE="$SCRIPT_DIR/multi_channel_processing.patch"

echo "🚀 Multi-Channel Parallel Processing Patch"
echo "=========================================="
echo ""

# Check if we're in the correct directory
if [ ! -f "manage.py" ]; then
    echo "❌ Error: This script must be run from the StreamFlow root directory"
    echo "   Current directory: $(pwd)"
    exit 1
fi

# Check if patch file exists
if [ ! -f "$PATCH_FILE" ]; then
    echo "❌ Error: Patch file not found at $PATCH_FILE"
    exit 1
fi

echo "📁 Current directory: $(pwd)"
echo "📄 Patch file: $PATCH_FILE"
echo ""

# Create backup
BACKUP_DIR="multi_channel_backup_$(date +%Y%m%d_%H%M%S)"
echo "💾 Creating backup in $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"

echo "   Backing up files..."
[ -f "backend/stream_checker_service.py" ] && cp "backend/stream_checker_service.py" "$BACKUP_DIR/"
[ -f "frontend/src/pages/AutomationSettings.jsx" ] && cp "frontend/src/pages/AutomationSettings.jsx" "$BACKUP_DIR/"

echo "✅ Backup created successfully"
echo ""

# Apply the patch
echo "🔧 Applying Multi-Channel Processing patch..."
if git apply --check "$PATCH_FILE" 2>/dev/null; then
    git apply "$PATCH_FILE"
    echo "✅ Patch applied successfully using git apply"
elif patch --dry-run -p1 < "$PATCH_FILE" >/dev/null 2>&1; then
    patch -p1 < "$PATCH_FILE"
    echo "✅ Patch applied successfully using patch command"
else
    echo "❌ Error: Patch could not be applied cleanly"
    echo "   Backup is available in: $BACKUP_DIR"
    exit 1
fi

echo ""
echo "🎉 Multi-Channel Processing Applied Successfully!"
echo "================================================"
echo ""
echo "✨ New Feature:"
echo "   • Check multiple channels simultaneously"
echo "   • Dynamic channel processing"
echo "   • Auto-calculate optimal channel count"
echo "   • Respects all limits (Global, Account, Profile)"
echo ""
echo "🔄 Next Steps:"
echo "   1. Restart backend: docker-compose restart backend"
echo "   2. Rebuild frontend: docker-compose restart frontend"
echo "   3. Go to: Automation Settings → Stream Checker"
echo "   4. Find: Multi-Channel Parallel Processing card"
echo "   5. Toggle ON and click 'Auto' button"
echo ""
echo "📚 Documentation: MULTI_CHANNEL_PROCESSING_PATCH_README.md"
echo "💾 Backup: $BACKUP_DIR"
echo ""
echo "🎯 Enjoy faster channel checking!"
