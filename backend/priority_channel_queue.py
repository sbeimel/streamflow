#!/usr/bin/env python3
"""
Priority Channel Queue for Dispatcharr Stream Checker.

Implements a priority-based queue for channel processing, ensuring that
important channels are checked first while maintaining fair processing
of all channels.

Features:
    - Heap-based priority queue for O(log n) operations
    - Configurable priorities per channel (0 = highest, 100 = lowest)
    - Default priority for channels without explicit settings
    - Thread-safe operations
    - Integration with channel settings

Performance Impact:
    - No time savings (same total processing time)
    - Better user experience (important channels processed first)
    - Improved perceived performance for high-priority channels
"""

import heapq
import logging
import threading
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Tuple

from logging_config import setup_logging

logger = setup_logging(__name__)


@dataclass(order=True)
class PrioritizedChannel:
    """
    A channel with priority for heap-based queue.
    
    Lower priority values are processed first (0 = highest priority).
    The dataclass is ordered by priority only, not by channel_id or data.
    """
    priority: int
    channel_id: int = field(compare=False)
    data: Any = field(compare=False)


class PriorityChannelQueue:
    """
    Thread-safe priority queue for channel processing.
    
    Channels with lower priority values are processed first.
    Default priority is 50 for channels without explicit settings.
    """
    
    def __init__(self):
        """Initialize the priority queue."""
        self.queue = []
        self.priorities: Dict[int, int] = {}
        self.lock = threading.Lock()
        self.default_priority = 50
        
        logger.info("Priority channel queue initialized")
    
    def set_priority(self, channel_id: int, priority: int):
        """
        Set priority for a specific channel.
        
        Args:
            channel_id: The channel ID
            priority: Priority value (0 = highest, 100 = lowest)
        """
        with self.lock:
            # Clamp priority to valid range
            priority = max(0, min(100, priority))
            self.priorities[channel_id] = priority
            logger.debug(f"Set priority {priority} for channel {channel_id}")
    
    def get_priority(self, channel_id: int) -> int:
        """
        Get priority for a channel.
        
        Args:
            channel_id: The channel ID
            
        Returns:
            Priority value (0-100), or default_priority if not set
        """
        with self.lock:
            return self.priorities.get(channel_id, self.default_priority)
    
    def set_default_priority(self, priority: int):
        """
        Set the default priority for channels without explicit settings.
        
        Args:
            priority: Default priority value (0-100)
        """
        with self.lock:
            self.default_priority = max(0, min(100, priority))
            logger.info(f"Set default priority to {self.default_priority}")
    
    def add_channel(self, channel_id: int, data: Any):
        """
        Add a channel to the priority queue.
        
        Args:
            channel_id: The channel ID
            data: Associated data (e.g., channel info, streams, etc.)
        """
        with self.lock:
            priority = self.priorities.get(channel_id, self.default_priority)
            item = PrioritizedChannel(priority, channel_id, data)
            heapq.heappush(self.queue, item)
            logger.debug(f"Added channel {channel_id} to queue with priority {priority}")
    
    def get_next(self) -> Tuple[Optional[int], Optional[Any]]:
        """
        Get the next channel from the queue (highest priority).
        
        Returns:
            Tuple of (channel_id, data), or (None, None) if queue is empty
        """
        with self.lock:
            if self.queue:
                item = heapq.heappop(self.queue)
                logger.debug(f"Retrieved channel {item.channel_id} from queue (priority {item.priority})")
                return item.channel_id, item.data
            return None, None
    
    def peek_next(self) -> Tuple[Optional[int], Optional[int]]:
        """
        Peek at the next channel without removing it.
        
        Returns:
            Tuple of (channel_id, priority), or (None, None) if queue is empty
        """
        with self.lock:
            if self.queue:
                item = self.queue[0]
                return item.channel_id, item.priority
            return None, None
    
    def size(self) -> int:
        """
        Get the current queue size.
        
        Returns:
            Number of channels in the queue
        """
        with self.lock:
            return len(self.queue)
    
    def is_empty(self) -> bool:
        """
        Check if the queue is empty.
        
        Returns:
            True if queue is empty, False otherwise
        """
        with self.lock:
            return len(self.queue) == 0
    
    def clear(self):
        """Clear all channels from the queue."""
        with self.lock:
            self.queue.clear()
            logger.info("Priority queue cleared")
    
    def load_priorities_from_settings(self, channel_settings_manager):
        """
        Load channel priorities from channel settings manager.
        
        Args:
            channel_settings_manager: Instance of ChannelSettingsManager
        """
        with self.lock:
            loaded_count = 0
            for channel_id, settings in channel_settings_manager._settings.items():
                if 'priority' in settings:
                    priority = settings['priority']
                    # Validate and clamp priority
                    priority = max(0, min(100, priority))
                    self.priorities[channel_id] = priority
                    loaded_count += 1
            
            logger.info(f"Loaded {loaded_count} channel priorities from settings")
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        Get queue statistics.
        
        Returns:
            Dict with queue size, priority distribution, etc.
        """
        with self.lock:
            if not self.queue:
                return {
                    'size': 0,
                    'priority_distribution': {},
                    'next_channel': None,
                    'next_priority': None
                }
            
            # Count channels by priority range
            priority_distribution = {
                'high (0-33)': 0,
                'medium (34-66)': 0,
                'low (67-100)': 0
            }
            
            for item in self.queue:
                if item.priority <= 33:
                    priority_distribution['high (0-33)'] += 1
                elif item.priority <= 66:
                    priority_distribution['medium (34-66)'] += 1
                else:
                    priority_distribution['low (67-100)'] += 1
            
            next_item = self.queue[0] if self.queue else None
            
            return {
                'size': len(self.queue),
                'priority_distribution': priority_distribution,
                'next_channel': next_item.channel_id if next_item else None,
                'next_priority': next_item.priority if next_item else None
            }


# Global instance (singleton pattern)
_priority_queue_instance: Optional[PriorityChannelQueue] = None
_priority_queue_lock = threading.Lock()


def get_priority_queue() -> PriorityChannelQueue:
    """
    Get the global priority queue instance (singleton pattern).
    
    Returns:
        PriorityChannelQueue instance
    """
    global _priority_queue_instance
    
    if _priority_queue_instance is None:
        with _priority_queue_lock:
            if _priority_queue_instance is None:
                _priority_queue_instance = PriorityChannelQueue()
    
    return _priority_queue_instance
