# Re-Score & Re-Sort Feature

## Overview

The **Re-Score & Re-Sort** feature allows you to recalculate stream scores and re-sort all channels **without performing new quality checks**. This is much faster than running a full Global Action since it skips time-consuming ffmpeg analysis.

## When to Use

Use Re-Score & Re-Sort after changing:

- ✅ **M3U Account Priorities** - Apply new priority boosts immediately
- ✅ **Account Stream Limits** - Enforce new limits (global or per-account)
- ✅ **Quality Preferences** - Apply channel-specific quality settings (prefer 4K, max 1080p, etc.)
- ✅ **Scoring Weights** - Adjust importance of bitrate, resolution, FPS, codec
- ✅ **Provider Diversification** - Enable/disable diversification settings

## How It Works

### 1. Uses Existing Data
- No new ffmpeg analysis
- Uses cached `stream_stats` from previous quality checks
- Only streams with existing stats are processed

### 2. Re-Calculates Scores
Scores are recalculated based on **current configuration**:
- Resolution score (1080p > 720p > 576p)
- Bitrate score (normalized to 1000-8000 kbps range)
- FPS score (50/60fps > 25/30fps)
- Codec score (H.265 vs H.264)
- **M3U Account Priority Boost** (current priorities)
- **Quality Preference Boost/Penalty** (current channel settings)

### 3. Re-Sorts Streams
- Streams are sorted by score (highest first)
- Best quality streams appear first

### 4. Applies Account Limits
- Account stream limits are applied **AFTER** sorting
- Only the **best** streams per account are kept
- Lower-quality streams are removed if over limit

### 5. Updates Channels
- Channel-stream assignments are updated in UDI
- Changes are immediately visible in the UI

## Usage

### Frontend (UI)

Click the **"Re-Score & Re-Sort"** button in the Stream Checker page:

```
Stream Checker Page → Top Right → "Re-Score & Re-Sort" Button
```

The button shows:
- ✨ Sparkles icon
- Loading spinner during operation
- Success toast with statistics

### Backend (API)

```bash
POST /api/stream-checker/rescore-resort
```

**Response:**
```json
{
  "message": "Re-score and re-sort completed successfully",
  "status": "completed",
  "stats": {
    "channels_processed": 150,
    "channels_updated": 145,
    "streams_before": 2500,
    "streams_after": 2200,
    "streams_removed": 300,
    "duration_seconds": 2.5
  },
  "channels_with_changes": [
    {
      "channel_id": 123,
      "channel_name": "Example Channel",
      "streams_before": 20,
      "streams_after": 15,
      "streams_removed": 5
    }
  ]
}
```

## Performance

**Speed Comparison:**

| Operation | Duration | Quality Checks |
|-----------|----------|----------------|
| **Global Action** | 30-60 minutes | ✅ Yes (ffmpeg) |
| **Re-Score & Re-Sort** | 2-5 seconds | ❌ No |

**Example:**
- 150 channels with 2500 streams
- Re-Score & Re-Sort: **~3 seconds**
- Global Action: **~45 minutes**

## Example Scenarios

### Scenario 1: Change Account Priorities

**Before:**
- Account A: Priority 50
- Account B: Priority 30

**Action:**
1. Change Account A to Priority 100
2. Click "Re-Score & Re-Sort"

**Result:**
- Account A streams get higher scores (+20 boost instead of +10)
- Channels are re-sorted with Account A streams first
- No quality checks needed

### Scenario 2: Apply New Account Limits

**Before:**
- No account limits
- Channel has 10 streams from Account A

**Action:**
1. Set Account A limit to 3 streams per channel
2. Click "Re-Score & Re-Sort"

**Result:**
- Only the 3 **best** streams from Account A remain
- 7 lower-quality streams are removed
- All channels updated instantly

### Scenario 3: Change Quality Preferences

**Before:**
- Channel set to "default" quality preference
- Has mix of 4K, 1080p, and 720p streams

**Action:**
1. Change channel to "max_1080p"
2. Click "Re-Score & Re-Sort"

**Result:**
- All 4K streams get -10 penalty (effectively excluded)
- 1080p and 720p streams remain
- Channel updated without re-checking

## Technical Details

### Backend Function

```python
def rescore_and_resort_all_channels(self):
    """Re-calculate scores and re-sort all channels using existing stream stats."""
```

**Located in:** `backend/stream_checker_service.py`

### API Endpoint

```python
@app.route('/api/stream-checker/rescore-resort', methods=['POST'])
def rescore_and_resort_all_channels():
    """Re-score and re-sort all channels using existing stream stats."""
```

**Located in:** `backend/web_api.py`

### Frontend Components

**API Function:**
```javascript
rescoreAndResort: () => api.post('/stream-checker/rescore-resort')
```

**Located in:** `frontend/src/services/api.js`

**Handler:**
```javascript
const handleRescoreAndResort = async () => {
  // Calls API and shows toast with results
}
```

**Located in:** `frontend/src/pages/StreamChecker.jsx`

## Limitations

- ❌ **Requires existing stats** - Streams without `stream_stats` are skipped
- ❌ **No new quality data** - Resolution, bitrate, codec remain unchanged
- ❌ **No dead stream detection** - Dead streams are not re-checked

**Solution:** Use "Test Streams Without Stats" or "Global Action" to get fresh quality data first.

## Comparison with Other Features

| Feature | Quality Checks | Speed | Use Case |
|---------|---------------|-------|----------|
| **Global Action** | ✅ Yes | Slow (30-60 min) | Full update + quality check |
| **Test Streams Without Stats** | ✅ Yes (only new) | Medium (5-15 min) | Check new streams only |
| **Re-Score & Re-Sort** | ❌ No | Fast (2-5 sec) | Apply config changes |

## Best Practices

1. **After Config Changes:** Use Re-Score & Re-Sort for instant results
2. **After M3U Upload:** Use "Test Streams Without Stats" first, then Re-Score & Re-Sort
3. **Regular Maintenance:** Use Global Action for complete quality checks
4. **Experimenting:** Use Re-Score & Re-Sort to test different priorities/limits quickly

## Logging

The operation logs detailed information:

```
RE-SCORE & RE-SORT ALL CHANNELS (using existing stats)
Processing channel: Example Channel (ID: 123)
Channel Example Channel: 20 streams scored and sorted
Channel Example Channel: Removed 5 stream(s) due to account limits
✓ Updated channel Example Channel: 20 → 15 streams
RE-SCORE & RE-SORT COMPLETED in 2.50s
  Channels processed: 150
  Channels updated: 145
  Total streams before: 2500
  Total streams after: 2200
  Streams removed by limits: 300
```

## Version

- **Added in:** StreamFlow Enhancements v2.0
- **Requires:** Profile Failover v2.0, Account Stream Limits feature
