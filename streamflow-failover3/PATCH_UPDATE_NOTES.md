# Patch Update Notes - Profile Failover v2.0

## Changes to streamflow_enhancements.patch

### 1. Updated Profile Failover Configuration (backend/stream_checker_service.py)

**Old:**
```python
'profile_failover': {
    'enabled': True,
    'try_full_profiles': False,
    'phase2_timeout': 60
}
```

**New:**
```python
'profile_failover': {
    'enabled': True,
    'try_full_profiles': True,
    'phase2_max_wait': 600,  # Maximum wait time in Phase 2 (seconds)
    'phase2_poll_interval': 10  # Check for free profiles every X seconds
}
```

### 2. Updated Phase 2 Implementation (backend/stream_checker_service.py)

**Old Phase 2:** Blind waiting up to 5 minutes per profile
**New Phase 2:** Intelligent polling every 10 seconds

**Replace the Phase 2 section in `_analyze_stream_with_profile_failover()` with:**

```python
# Phase 2: All available profiles failed - try ALL profiles (including full ones) with intelligent polling
if udi and stream.get('m3u_account'):
    all_profiles = udi.get_all_profiles_for_stream(stream)
    tried_profile_ids = {p.get('id') for p in available_profiles}
    remaining_profiles = [p for p in all_profiles if p.get('id') not in tried_profile_ids]
    
    if remaining_profiles:
        # Get Phase 2 configuration
        phase2_enabled = self.config.get('profile_failover', {}).get('try_full_profiles', True)
        
        if not phase2_enabled:
            logger.info(f"Stream {stream_id} ({stream_name}): Phase 2 disabled, skipping {len(remaining_profiles)} full profile(s)")
        else:
            phase2_max_wait = self.config.get('profile_failover', {}).get('phase2_max_wait', 600)
            phase2_poll_interval = self.config.get('profile_failover', {}).get('phase2_poll_interval', 10)
            
            logger.warning(f"Stream {stream_id} ({stream_name}): Phase 2 - All available profiles failed, trying {len(remaining_profiles)} additional profile(s) with intelligent polling")
            logger.info(f"Stream {stream_id}: Phase 2 config - max_wait: {phase2_max_wait}s, poll_interval: {phase2_poll_interval}s")
            
            import time
            start_time = time.time()
            tested_profile_ids = set(tried_profile_ids)
            
            # Intelligent polling loop
            while remaining_profiles and (time.time() - start_time) < phase2_max_wait:
                # Check which profiles are NOW available
                currently_available = udi.get_all_available_profiles_for_stream(stream)
                currently_available_ids = {p.get('id') for p in currently_available}
                
                # Find profiles that are NOW available AND not yet tested
                newly_available = [
                    p for p in remaining_profiles 
                    if p.get('id') in currently_available_ids 
                    and p.get('id') not in tested_profile_ids
                ]
                
                if newly_available:
                    # Test the first newly available profile
                    profile = newly_available[0]
                    profile_id = profile.get('id')
                    profile_name = profile.get('name', f'Profile {profile_id}')
                    
                    try:
                        stream_url = udi.apply_profile_url_transformation(stream, profile)
                        elapsed = time.time() - start_time
                        logger.info(f"Stream {stream_id}: Testing newly available profile {profile_name} (ID: {profile_id}) [elapsed: {elapsed:.1f}s]")
                        
                        proxy = get_stream_proxy(stream_id)
                        
                        analyzed = analyze_stream(
                            stream_url=stream_url,
                            stream_id=stream_id,
                            stream_name=stream_name,
                            ffmpeg_duration=analysis_params.get('ffmpeg_duration', 20),
                            timeout=analysis_params.get('timeout', 30),
                            retries=analysis_params.get('retries', 1),
                            retry_delay=analysis_params.get('retry_delay', 10),
                            user_agent=analysis_params.get('user_agent', 'VLC/3.0.14'),
                            stream_startup_buffer=analysis_params.get('stream_startup_buffer', 10),
                            proxy=proxy
                        )
                        
                        tested_profile_ids.add(profile_id)
                        remaining_profiles = [p for p in remaining_profiles if p.get('id') != profile_id]
                        
                        if not self._is_stream_dead(analyzed) and analyzed.get('status') == 'OK':
                            logger.info(f"Stream {stream_id}: ✅ SUCCESS with profile {profile_name} (ID: {profile_id}) in Phase 2")
                            analyzed['used_profile_id'] = profile_id
                            analyzed['used_profile_name'] = profile_name
                            analyzed['profile_failover_attempts'] = len(tested_profile_ids)
                            analyzed['profile_failover_phase'] = 2
                            analyzed['phase2_elapsed_time'] = time.time() - start_time
                            return analyzed
                        else:
                            status = analyzed.get('status', 'Unknown')
                            logger.warning(f"Stream {stream_id}: ❌ FAILED with profile {profile_name} (ID: {profile_id}) - Status: {status}")
                            last_error = analyzed
                            
                    except Exception as e:
                        logger.error(f"Stream {stream_id}: ❌ ERROR with profile {profile_name} (ID: {profile_id}): {e}")
                        tested_profile_ids.add(profile_id)
                        remaining_profiles = [p for p in remaining_profiles if p.get('id') != profile_id]
                        last_error = {
                            'stream_id': stream_id,
                            'stream_name': stream_name,
                            'stream_url': stream.get('url', ''),
                            'status': 'Error',
                            'error': str(e)
                        }
                else:
                    # No profiles available right now, wait and check again
                    if remaining_profiles:
                        elapsed = time.time() - start_time
                        remaining_time = phase2_max_wait - elapsed
                        logger.debug(f"Stream {stream_id}: No profiles available, waiting {phase2_poll_interval}s (elapsed: {elapsed:.1f}s, remaining: {remaining_time:.1f}s)")
                        time.sleep(phase2_poll_interval)
            
            # Phase 2 completed or timed out
            elapsed = time.time() - start_time
            if remaining_profiles:
                logger.warning(f"Stream {stream_id}: Phase 2 timeout after {elapsed:.1f}s, {len(remaining_profiles)} profile(s) not tested")
            else:
                logger.info(f"Stream {stream_id}: Phase 2 completed after {elapsed:.1f}s, all profiles tested")
```

### 3. New Frontend Settings (frontend/src/pages/StreamChecker.jsx)

Add Profile Failover settings in the "Stream Ordering" tab after Provider Diversification card.

### 4. New API Endpoint (backend/web_api.py)

Add after `apply_account_limits_to_channels()`:

```python
@app.route('/api/stream-checker/test-streams-without-stats', methods=['POST'])
def test_streams_without_stats():
    """Test all streams that have no quality stats (never been checked)."""
    # Implementation as shown in web_api.py
```

### 5. New Frontend Button (frontend/src/pages/StreamChecker.jsx)

Add "Test Streams Without Stats" button next to "Global Action" button.

### 6. Updated Documentation

- PROFILE_FAILOVER_README.md updated with intelligent polling explanation
- Added info about Priority System + Provider Diversification interaction

## Summary

- **Phase 2 now uses intelligent polling** instead of blind waiting
- **Configurable timeouts** via frontend
- **New button** to test streams without stats
- **Better documentation** about feature interactions
