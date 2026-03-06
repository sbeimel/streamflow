#!/usr/bin/env python3
"""Apply M3U Filter Fix - Version 2"""

# Read file
with open('backend/stream_checker_service.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Code to insert
insert_code = [
    "            \n",
    "            # Check if M3U filter is set for this channel (from Discover & Test for specific M3U)\n",
    "            m3u_filter = self.update_tracker.get_m3u_filter_for_channel(channel_id)\n",
    "            \n",
    "            if m3u_filter is not None:\n",
    "                original_count = len(streams)\n",
    "                streams = [s for s in streams if s.get('m3u_account') == m3u_filter]\n",
    "                filtered_count = len(streams)\n",
    "                \n",
    "                logger.info(f\"🔍 M3U Filter applied: {original_count} total streams → {filtered_count} from M3U account {m3u_filter}\")\n",
    "                \n",
    "                if filtered_count == 0:\n",
    "                    logger.warning(f\"No streams from M3U account {m3u_filter} found in channel {channel_name}\")\n",
    "                    # Clear filter and mark as completed\n",
    "                    self.update_tracker.clear_m3u_filter(channel_id)\n",
    "                    self.check_queue.mark_completed(channel_id)\n",
    "                    self.update_tracker.mark_channel_checked(channel_id)\n",
    "                    return {\n",
    "                        'dead_streams_count': 0,\n",
    "                        'revived_streams_count': 0\n",
    "                    }\n",
]

# Find lines to insert after (line 2043 and 2607 - but 0-indexed so 2042 and 2606)
insert_after_lines = []
for i, line in enumerate(lines):
    if 'logger.info(f"Found {len(streams)} streams for channel {channel_name}")' in line:
        # Check next line is empty
        if i + 1 < len(lines) and lines[i + 1].strip() == '':
            insert_after_lines.append(i + 1)  # Insert after the empty line

print(f"Found {len(insert_after_lines)} insertion points: {insert_after_lines}")

# Insert code at each location (in reverse to maintain line numbers)
for insert_pos in reversed(insert_after_lines):
    lines[insert_pos:insert_pos] = insert_code

# Write back
with open('backend/stream_checker_service.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"✅ Inserted M3U filter code at {len(insert_after_lines)} location(s)")
