# Enable Disabled Playlists (Priority-Only) Feature

## Overview

The Enable Disabled Playlists feature allows you to configure disabled M3U accounts to participate in stream matching while skipping FFmpeg-based quality analysis. This enables you to use backup/fallback providers that are normally disabled, with M3U priority-based sorting instead of quality scores.

**⚠️ Important: This feature must be explicitly enabled and configured to take effect.**

## How It Works

### Normal M3U Accounts (Enabled, Quality Check)
- ✅ **Stream Matching**: Streams are matched to channels via regex patterns
- ✅ **Quality Analysis**: FFmpeg analyzes bitrate, resolution, FPS, codec
- ✅ **Quality Scoring**: Streams are scored and sorted by quality
- ✅ **Dead Stream Detection**: Non-working streams are detected and removed
- ✅ **Provider Limits**: Account-specific stream limits are applied

### Disabled M3U Accounts (Priority-Only, when feature enabled)
- ✅ **Stream Matching**: Streams are matched to channels via regex patterns  
- ❌ **Quality Analysis**: No FFmpeg analysis (faster processing)
- ✅ **Priority Sorting**: Streams are sorted by M3U account priority
- ❌ **Dead Stream Detection**: Streams are never marked as dead
- ✅ **Provider Limits**: Account stream limits still apply normally
- ❌ **Automatic Removal**: Streams are never removed due to quality issues

### When Feature is Disabled
- **Original Behavior**: Only enabled M3U accounts are processed
- **Disabled Playlists**: Completely ignored (as in original version)

## Configuration

### Backend Configuration

Enable the feature and configure excluded accounts in Stream Checker configuration:

```json
{
  "quality_check_exclusions": {
    "enabled": true,
    "excluded_accounts": [4, 5]
  }
}
```

### Frontend Configuration

1. Navigate to **Automation Settings** → **Automation** tab
2. Scroll down to **Enable Disabled Playlists (Priority-Only)** section
3. **Enable the feature** by toggling the switch
4. Check the disabled M3U accounts you want to include for stream matching
5. Save settings

**Note**: Only disabled/inactive M3U accounts are shown in the selection list.

## Use Cases

### 1. Backup/Fallback Providers
```json
{
  "enabled_m3u_accounts": [1, 2, 3],
  "quality_check_exclusions": {
    "enabled": true,
    "excluded_accounts": [3]
  }
}
```
- Accounts 1-2: Primary providers with quality analysis
- Account 3: Backup provider using priority sorting (stable, no removal)

### 2. Trusted High-Quality Sources
```json
{
  "enabled_m3u_accounts": [1, 2],
  "quality_check_exclusions": {
    "enabled": true,
    "excluded_accounts": [1]
  }
}
```
- Account 1: Trusted premium provider (no analysis needed)
- Account 2: Regular provider with quality checking

## Stream Removal and Management

### What Gets Protected
- ✅ **Quality-excluded streams are protected from automatic removal**
- ✅ **Rescore & Resort operations preserve these streams**
- ✅ **Global checks skip quality analysis for these streams**
- ✅ **Provider limits still apply (keeps best streams by priority)**

### How to Remove Quality-Excluded Streams

Since quality-excluded streams are protected from automatic removal, you can remove them manually:

1. **Manual Channel Editing**: Edit channels directly in Dispatcharr
2. **Rescore & Resort**: Will apply provider limits but won't remove due to quality
3. **Disable Feature**: Temporarily disable quality exclusions, run checks, re-enable
4. **Remove from Exclusion List**: Remove account from exclusions, run quality check

### Provider Limits Still Apply

**Important**: Account stream limits work normally for quality-excluded streams:
- Limits are applied after priority-based sorting
- Only the best streams (by M3U priority) are kept
- Excess streams are removed to respect limits
- This ensures channel stability while respecting configured limits

## Technical Implementation

### Stream Processing Flow

1. **Feature Check**: Only process exclusions if `enabled: true`
2. **Stream Discovery**: All enabled accounts participate in stream matching
3. **Categorization**: Streams are split into two categories:
   - Quality check streams (normal FFmpeg analysis)
   - Priority-only streams (M3U priority scoring)
4. **Processing**: 
   - Quality streams: FFmpeg analysis → Quality scoring → Dead stream detection
   - Priority streams: M3U priority scoring → No analysis
5. **Sorting**: Combined results sorted by score (quality or priority)
6. **Provider Limits**: Applied to both types of streams

### Scoring System

- **Quality Check Streams**: Score = Quality algorithm (0-100)
- **Priority-Only Streams**: Score = M3U Account Priority (default: 50)

### Global Check Behavior

Quality-excluded streams are also protected during global checks:
- ❌ No FFmpeg analysis performed
- ❌ Never marked as dead
- ✅ Provider limits still applied
- ✅ Rescore & Resort operations preserve them

## API Endpoints

### Get Configuration
```http
GET /api/stream-checker/config
```

### Update Configuration
```http
PUT /api/stream-checker/config
Content-Type: application/json

{
  "quality_check_exclusions": {
    "enabled": true,
    "excluded_accounts": [4, 5]
  }
}
```

## Logging

The system logs quality check exclusions:

```
INFO: Quality check exclusions enabled with 2 excluded accounts
INFO: Marked 15 streams from quality-excluded accounts (will use M3U priority sorting)
INFO: Found 25 streams for quality analysis
INFO: Processing 15 priority-only streams (no quality analysis)
DEBUG: Priority-only stream 12345: Stream Name (score: 75.0)
```

## Compatibility

- **Existing Configurations**: Fully backward compatible
- **Default Behavior**: Feature disabled by default (`enabled: false`)
- **Migration**: No migration needed, feature is opt-in

## Best Practices

1. **Explicit Activation**: Always enable the feature explicitly before configuring exclusions
2. **Use for Stable Providers**: Exclude accounts with consistently good quality
3. **Backup Strategy**: Exclude backup providers to ensure they're never removed
4. **Performance Optimization**: Exclude high-volume accounts to reduce analysis load
5. **Priority Configuration**: Ensure excluded accounts have appropriate M3U priorities
6. **Monitor Results**: Check that priority-based sorting meets your needs
7. **Provider Limits**: Configure appropriate limits for excluded accounts

## Troubleshooting

### Feature Not Working
- Verify `quality_check_exclusions.enabled` is `true`
- Check that accounts are in `excluded_accounts` array
- Ensure accounts are also in `enabled_m3u_accounts` (automation config)
- Verify accounts are active in Dispatcharr

### Streams Still Being Analyzed
- Check feature is enabled in Stream Checker config (not automation config)
- Verify account IDs match exactly
- Check logs for "Priority-only streams" messages

### Streams Being Removed
- Quality-excluded streams should never be removed due to quality issues
- Provider limits may still remove excess streams (this is normal)
- Check if streams are being removed due to regex pattern changes

### Priority Sorting Issues
- Check M3U account priority values in Dispatcharr
- Higher priority = higher score = better position
- Default priority is 50 if not configured