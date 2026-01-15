# Profile Failover for Quality Checks

## Overview

Profile Failover automatically retries failed stream quality checks with different M3U account profiles. This significantly improves stream reliability by testing multiple profiles before marking a stream as dead.

## How It Works

### Two-Phase Strategy

#### **Phase 1: Available Profiles (Fast)**
- Tests all profiles with **immediately available slots**
- No waiting - only uses profiles that are free right now
- Typical duration: 30-90 seconds per stream

**Example:**
```
Profile A: 1/2 slots used → ✅ Test immediately
Profile B: 0/2 slots used → ✅ Test immediately  
Profile C: 2/2 slots used → ⏭️ Skip (full)
```

#### **Phase 2: Full Profiles with Intelligent Polling (Optional)**
- **Intelligently polls** for full profiles to become available
- Checks every **10 seconds** (configurable) if untested profiles are now free
- Tests profiles as soon as they become available
- Stops when:
  - All profiles have been tested, OR
  - Maximum wait time reached (default: 10 minutes)

**Example:**
```
Time 0:00 → Profile C still full, wait 10s
Time 0:10 → Profile C still full, wait 10s
Time 0:20 → Profile C now free! → Test immediately ✅
Time 0:50 → Profile C failed, all profiles tested → Done
```

### Key Features

1. **No Blind Waiting**: Instead of waiting 5 minutes per profile, actively checks every 10s
2. **Fair Distribution**: Multiple streams can grab different profiles as they become free
3. **Automatic Termination**: Stops when all profiles tested or timeout reached
4. **Configurable**: All timeouts and intervals can be adjusted

## Configuration

### Backend Config (`stream_checker_config.json`)

```json
{
  "profile_failover": {
    "enabled": true,
    "try_full_profiles": true,
    "phase2_max_wait": 600,
    "phase2_poll_interval": 10
  }
}
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `true` | Enable/disable profile failover completely |
| `try_full_profiles` | `true` | Enable Phase 2 (test full profiles with polling) |
| `phase2_max_wait` | `600` | Maximum wait time in Phase 2 (seconds) |
| `phase2_poll_interval` | `10` | How often to check for free profiles (seconds) |

### Frontend Settings

Available in **Stream Checker → Stream Ordering Tab**:
- ✅ Enable Profile Failover
- ✅ Try Full Profiles (Phase 2)
- 🔢 Phase 2 Maximum Wait Time (60-1800 seconds)
- 🔢 Phase 2 Poll Interval (5-60 seconds)

## Performance Considerations

### Without Profile Failover (Original)
```
Stream fails with Profile A → Marked as dead → Removed
Total time: ~30 seconds
```

### With Profile Failover - Phase 1 Only
```
Stream fails with Profile A → Try Profile B → Try Profile C → Success
Total time: ~90 seconds (3 profiles × 30s)
```

### With Profile Failover - Phase 1 + 2
```
Phase 1: Try available profiles (A, B) → Failed (~60s)
Phase 2: Poll for full profiles (C, D)
  - Check every 10s if C or D free
  - Test as soon as available
  - Stop after 10 minutes or all tested
Total time: 60s - 10 minutes (depending on profile availability)
```

## Retry Logic

Each profile is tested with the configured retry count:

```json
{
  "stream_analysis": {
    "retries": 1,
    "retry_delay": 10
  }
}
```

**With `retries=1`:**
- Attempt 1: Test stream (~30s)
- Wait 10s
- Attempt 2: Retry (~30s)
- Total per profile: ~70s if both attempts fail

## Use Cases

### Recommended: Phase 1 Only (Fast)
```json
{
  "profile_failover": {
    "enabled": true,
    "try_full_profiles": false
  }
}
```
- ✅ Fast quality checks
- ✅ Tests all immediately available profiles
- ✅ Good balance between speed and reliability
- ❌ Doesn't test profiles that are temporarily full

### Maximum Reliability: Phase 1 + 2
```json
{
  "profile_failover": {
    "enabled": true,
    "try_full_profiles": true,
    "phase2_max_wait": 300,
    "phase2_poll_interval": 10
  }
}
```
- ✅ Tests ALL profiles eventually
- ✅ Maximum redundancy
- ✅ Intelligent polling (no blind waiting)
- ⚠️ Slower for streams that fail Phase 1

### Disabled: Original Behavior
```json
{
  "profile_failover": {
    "enabled": false
  }
}
```
- ✅ Fastest (no retries with other profiles)
- ❌ Less reliable (single profile failure = dead stream)

## Logging

Profile failover provides detailed logging:

```
Stream 123 (Example): Phase 1 - Trying 2 available profile(s)
Stream 123: Trying available profile 1/2 - Profile A (ID: 1)
Stream 123: ❌ FAILED with available profile Profile A (ID: 1) - Status: Error
Stream 123: Trying available profile 2/2 - Profile B (ID: 2)
Stream 123: ✅ SUCCESS with available profile Profile B (ID: 2)
```

**Phase 2 with polling:**
```
Stream 123: Phase 2 - All available profiles failed, trying 2 additional profile(s) with intelligent polling
Stream 123: Phase 2 config - max_wait: 600s, poll_interval: 10s
Stream 123: No profiles available, waiting 10s (elapsed: 0.0s, remaining: 600.0s)
Stream 123: Testing newly available profile Profile C (ID: 3) [elapsed: 20.5s]
Stream 123: ✅ SUCCESS with profile Profile C (ID: 3) in Phase 2
```

## Benefits

1. **Improved Reliability**: Streams aren't marked dead just because one profile fails
2. **Better Resource Utilization**: Uses all available profiles efficiently
3. **Intelligent Polling**: No blind waiting - actively checks for free profiles
4. **Fair Distribution**: Multiple streams can use different profiles simultaneously
5. **Configurable**: Adjust timeouts and intervals based on your needs
6. **Automatic Failover**: Works seamlessly with Dispatcharr's profile system

## Integration with Other Features

- ✅ Works with **Provider Diversification**
- ✅ Works with **Account Stream Limits**
- ✅ Works with **Dead Stream Tracking**
- ✅ Works with **Concurrent Stream Checking**
- ✅ Respects **2-Hour Immunity** for checked streams

## Troubleshooting

### Quality checks are slow
- **Solution 1**: Disable Phase 2 (`try_full_profiles: false`)
- **Solution 2**: Reduce `phase2_max_wait` (e.g., 180s instead of 600s)
- **Solution 3**: Increase `phase2_poll_interval` (e.g., 20s instead of 10s)

### Streams marked as dead too quickly
- **Solution**: Enable Phase 2 (`try_full_profiles: true`)
- Increase `phase2_max_wait` for more thorough testing

### Too many profiles being tested
- **Solution**: Reduce number of active profiles per M3U account
- Or disable Phase 2 to only test immediately available profiles

## Technical Details

### Profile Selection Logic

**Phase 1:**
```python
available_profiles = udi.get_all_available_profiles_for_stream(stream)
# Returns only profiles with: active_streams < max_streams
```

**Phase 2:**
```python
all_profiles = udi.get_all_profiles_for_stream(stream)
remaining_profiles = [p for p in all_profiles if p not in tried_profiles]

while remaining_profiles and elapsed < max_wait:
    currently_available = udi.get_all_available_profiles_for_stream(stream)
    newly_available = [p for p in remaining_profiles if p in currently_available]
    
    if newly_available:
        test_profile(newly_available[0])
    else:
        sleep(poll_interval)
```

### Timeout Behavior

After `phase2_max_wait` seconds:
- If stream has cached stats → Keep stream with old stats
- If stream is new (no cache) → Mark as dead
- Stream is NOT marked as "checked" → Will retry on next quality check

## Version History

- **v1.0**: Initial implementation with Phase 1 + Phase 2 (blind waiting)
- **v2.0**: Added intelligent polling in Phase 2 (no more blind waiting)
- **v2.1**: Made Phase 2 configurable with frontend settings
