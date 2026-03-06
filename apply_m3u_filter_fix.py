#!/usr/bin/env python3
"""
Apply M3U Filter Fix to stream_checker_service.py

This script adds M3U filtering to both _check_channel_concurrent and _check_channel_sequential methods.
"""

import re

# Read the file
with open('backend/stream_checker_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

# The code block to insert
m3u_filter_code = '''
            # Check if M3U filter is set for this channel (from Discover & Test for specific M3U)
            m3u_filter = self.update_tracker.get_m3u_filter_for_channel(channel_id)
            
            if m3u_filter is not None:
                original_count = len(streams)
                streams = [s for s in streams if s.get('m3u_account') == m3u_filter]
                filtered_count = len(streams)
                
                logger.info(f"🔍 M3U Filter applied: {original_count} total streams → {filtered_count} from M3U account {m3u_filter}")
                
                if filtered_count == 0:
                    logger.warning(f"No streams from M3U account {m3u_filter} found in channel {channel_name}")
                    # Clear filter and mark as completed
                    self.update_tracker.clear_m3u_filter(channel_id)
                    self.check_queue.mark_completed(channel_id)
                    self.update_tracker.mark_channel_checked(channel_id)
                    return {
                        'dead_streams_count': 0,
                        'revived_streams_count': 0
                    }
            
'''

# Pattern to find the insertion point
pattern = r'(            logger\.info\(f"Found \{len\(streams\)\} streams for channel \{channel_name\}"\)\n            \n)(            # Check if channel has active viewers)'

# Replace all occurrences
new_content = re.sub(pattern, r'\1' + m3u_filter_code + r'\2', content)

# Check if replacements were made
if new_content != content:
    # Write back
    with open('backend/stream_checker_service.py', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("✅ M3U filter code added to stream_checker_service.py")
    print(f"   Modified {content.count(pattern)} location(s)")
else:
    print("❌ No changes made - pattern not found or already applied")
