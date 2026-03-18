"""
Profile Check Semaphores - Thread-safe slot tracking for stream checks per profile.

Tracks how many stream checks are currently running per profile (separate from
active viewer counts). This ensures that:
  active_viewers + running_checks <= profile.max_streams

This is needed because get_active_streams_count_per_profile() only counts proxy
viewers, not ongoing stream checks. Without this, multiple threads would all see
a profile as "free" and start checks simultaneously, exceeding the slot limit.
"""

import threading
import time
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# Global lock for modifying the semaphore registry
_registry_lock = threading.Lock()

# {profile_id: {'semaphore': threading.Semaphore, 'max_streams': int, 'in_use': int}}
_profile_slots: Dict[int, Dict] = {}


def initialize_profile_slots(profiles_by_id: Dict[int, int]):
    """Initialize or update slot counts for profiles.

    Args:
        profiles_by_id: {profile_id: max_streams} - 0 means unlimited
    """
    with _registry_lock:
        # Update existing profiles
        for profile_id, max_streams in profiles_by_id.items():
            if profile_id not in _profile_slots:
                _profile_slots[profile_id] = {
                    'max_streams': max_streams,
                    'in_use': 0,
                    'lock': threading.Lock(),
                }
            else:
                _profile_slots[profile_id]['max_streams'] = max_streams
        
        # Clean up profiles that no longer exist (optional, prevents memory leak)
        current_profile_ids = set(profiles_by_id.keys())
        stale_profile_ids = set(_profile_slots.keys()) - current_profile_ids
        for profile_id in stale_profile_ids:
            # Only remove if not in use
            entry = _profile_slots[profile_id]
            with entry['lock']:
                if entry['in_use'] == 0:
                    del _profile_slots[profile_id]
                    logger.debug(f"Removed stale profile {profile_id} from slot tracking")


def get_check_slots_in_use(profile_id: int) -> int:
    """Return how many stream checks are currently running for this profile."""
    entry = _profile_slots.get(profile_id)
    if not entry:
        return 0
    with entry['lock']:
        in_use = entry['in_use']
        logger.debug(f"Profile {profile_id}: {in_use} check slots currently in use")
        return in_use


def try_acquire_check_slot(profile_id: int, viewer_count: int, max_streams: int) -> bool:
    """Try to acquire a check slot for a profile (non-blocking).

    Considers both active viewers and running checks:
        viewer_count + in_use < max_streams  →  slot available

    Args:
        profile_id: Profile ID
        viewer_count: Current active viewer count from proxy status
        max_streams: Maximum allowed concurrent streams (0 = unlimited)

    Returns:
        True if slot was acquired, False if at capacity
    """
    # Ensure entry exists and get its lock atomically
    with _registry_lock:
        if profile_id not in _profile_slots:
            _profile_slots[profile_id] = {
                'max_streams': max_streams,
                'in_use': 0,
                'lock': threading.Lock()
            }
        entry = _profile_slots[profile_id]
        entry_lock = entry['lock']
    
    # Now work with the entry lock (outside registry lock to avoid nested locking)
    with entry_lock:
        # For unlimited profiles, always acquire
        if max_streams == 0:
            entry['in_use'] += 1
            return True
        
        # Check capacity
        total = viewer_count + entry['in_use']
        if total < max_streams:
            entry['in_use'] += 1
            logger.debug(
                f"Profile {profile_id}: acquired check slot "
                f"(viewers={viewer_count}, checks={entry['in_use']}, max={max_streams})"
            )
            return True
        else:
            logger.debug(
                f"Profile {profile_id}: no slot available "
                f"(viewers={viewer_count}, checks={entry['in_use']}, max={max_streams})"
            )
            return False


def release_check_slot(profile_id: int):
    """Release a previously acquired check slot."""
    entry = _profile_slots.get(profile_id)
    if not entry:
        return
    with entry['lock']:
        if entry['in_use'] > 0:
            entry['in_use'] -= 1
            logger.debug(f"Profile {profile_id}: released check slot (checks now={entry['in_use']})")
