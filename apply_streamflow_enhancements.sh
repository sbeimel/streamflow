#!/bin/bash

# StreamFlow Enhancements Application Script
# This script applies all StreamFlow enhancements including:
# - HTTP Proxy Support for M3U Accounts
# - Channel Quality Preferences
# - Account Stream Limits for Channel Assignment
# - Multi-Channel Parallel Processing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_FILE="$SCRIPT_DIR/streamflow_enhancements.patch"

echo "🚀 StreamFlow Enhancements Application Script"
echo "=============================================="
echo ""

# Check if we're in the correct directory
if [ ! -f "manage.py" ]; then
    echo "❌ Error: This script must be run from the StreamFlow root directory (where manage.py is located)"
    echo "   Current directory: $(pwd)"
    echo "   Please navigate to your StreamFlow installation directory and run:"
    echo "   bash streamflow-dev/apply_streamflow_enhancements.sh"
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
BACKUP_DIR="streamflow_backup_$(date +%Y%m%d_%H%M%S)"
echo "💾 Creating backup in $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"

# Backup files that will be modified
echo "   Backing up files..."
cp -r backend "$BACKUP_DIR/" 2>/dev/null || echo "   - backend directory not found, skipping"
cp -r frontend "$BACKUP_DIR/" 2>/dev/null || echo "   - frontend directory not found, skipping"

echo "✅ Backup created successfully"
echo ""

# Apply the patch
echo "🔧 Applying StreamFlow enhancements patch..."
if git apply --check "$PATCH_FILE" 2>/dev/null; then
    git apply "$PATCH_FILE"
    echo "✅ Patch applied successfully using git apply"
elif patch --dry-run -p1 < "$PATCH_FILE" >/dev/null 2>&1; then
    patch -p1 < "$PATCH_FILE"
    echo "✅ Patch applied successfully using patch command"
else
    echo "❌ Error: Patch could not be applied cleanly"
    echo "   This might be due to:"
    echo "   - Files already modified"
    echo "   - Different StreamFlow version"
    echo "   - Conflicting changes"
    echo ""
    echo "   Manual application may be required."
    echo "   Backup is available in: $BACKUP_DIR"
    exit 1
fi

echo ""
echo "🎉 StreamFlow Enhancements Applied Successfully!"
echo "==============================================="
echo ""
echo "📋 Applied Features:"
echo "   ✅ HTTP Proxy Support for M3U Accounts"
echo "   ✅ Channel Quality Preferences (4K control per channel)"
echo "   ✅ Account Stream Limits for Channel Assignment"
echo "   ✅ Multi-Channel Parallel Processing"
echo ""
echo "🔄 Next Steps:"
echo "   1. Restart your StreamFlow backend service"
echo "   2. Rebuild your frontend (if using a build process)"
echo "   3. Check the new features in:"
echo "      - M3U Accounts: HTTP Proxy field"
echo "      - Channel Configuration: Quality Preference dropdown"
echo "      - Stream Checker: Account Limits tab"
echo ""
echo "📚 Documentation:"
echo "   - HTTP Proxy: streamflow-dev/STREAMFLOW_HTTP_PROXY_PATCH_README.md"
echo "   - Quality Preferences: streamflow-dev/CHANNEL_QUALITY_PREFERENCES_README.md"
echo "   - Account Limits: streamflow-dev/ACCOUNT_STREAM_LIMITS_README.md"
echo "   - Multi-Channel Processing: MULTI_CHANNEL_PARALLEL_IMPLEMENTATION.md"
echo ""
echo "💾 Backup Location: $BACKUP_DIR"
echo ""
echo "🎯 Enjoy your enhanced StreamFlow experience!"