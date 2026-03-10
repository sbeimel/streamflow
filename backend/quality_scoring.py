"""
Quality Scoring Module - MACstrom-inspired Reference-Bitrate Sigmoid Scoring

This module implements a more sophisticated quality scoring system based on
MACstrom's approach, which uses codec-aware reference bitrates and sigmoid curves
for better stream quality discrimination.
"""

import math
from typing import Dict, Optional, Tuple

# Reference bitrates (kbps) for "good quality" per codec/resolution
# Based on industry standards and MACstrom's implementation
REFERENCE_BITRATES = {
    # H.264 / AVC
    ('h264', '4k'): 35000,
    ('h264', '1080p'): 8000,
    ('h264', '720p'): 4000,
    ('h264', 'sd'): 1500,
    
    # HEVC / H.265 (more efficient, needs less bitrate)
    ('hevc', '4k'): 16000,
    ('hevc', '1080p'): 4500,
    ('hevc', '720p'): 2500,
    ('hevc', 'sd'): 900,
    
    # AV1 (most efficient)
    ('av1', '4k'): 12000,
    ('av1', '1080p'): 3500,
    ('av1', '720p'): 2000,
    ('av1', 'sd'): 700,
}

# Resolution ceilings - maximum score per resolution tier
# Ensures resolution hierarchy is respected (1080p always beats 720p)
RESOLUTION_CEILINGS = {
    '4k': 100,
    '1080p': 90,
    '720p': 75,
    'sd': 55,
}

# Off-air detection threshold (kbps)
# Streams below this are placeholder/color bars
NOT_STREAMING_THRESHOLD = 200


def normalize_codec(codec: str) -> str:
    """Normalize codec name to standard format."""
    if not codec or codec == 'N/A':
        return 'unknown'
    
    codec_lower = codec.lower()
    
    # H.265 / HEVC
    if 'h265' in codec_lower or 'hevc' in codec_lower:
        return 'hevc'
    
    # H.264 / AVC
    if 'h264' in codec_lower or 'avc' in codec_lower:
        return 'h264'
    
    # AV1
    if 'av1' in codec_lower:
        return 'av1'
    
    return 'unknown'


def classify_resolution(resolution: str) -> str:
    """Classify resolution into tier (4k, 1080p, 720p, sd)."""
    if not resolution or resolution == 'N/A' or 'x' not in resolution:
        return 'sd'
    
    try:
        width, height = map(int, resolution.split('x'))
        
        if height >= 2160:
            return '4k'
        elif height >= 1080:
            return '1080p'
        elif height >= 720:
            return '720p'
        else:
            return 'sd'
    except (ValueError, AttributeError):
        return 'sd'


def get_reference_bitrate(codec: str, resolution: str) -> int:
    """Get reference bitrate for codec/resolution combination."""
    normalized_codec = normalize_codec(codec)
    resolution_tier = classify_resolution(resolution)
    
    # Try exact match
    key = (normalized_codec, resolution_tier)
    if key in REFERENCE_BITRATES:
        return REFERENCE_BITRATES[key]
    
    # Fallback to H.264 if codec unknown
    fallback_key = ('h264', resolution_tier)
    return REFERENCE_BITRATES.get(fallback_key, 8000)


def sigmoid_adequacy(ratio: float) -> float:
    """
    Calculate adequacy score using sigmoid curve.
    
    The sigmoid provides:
    - Steep discrimination in critical region (40-100% of reference)
    - Smooth saturation above reference
    - Clear penalty below threshold
    
    Formula: 1 / (1 + exp(-3.5 × (ratio - 0.7)))
    
    Args:
        ratio: actual_bitrate / reference_bitrate
    
    Returns:
        Adequacy score (0.0 - 1.0)
    """
    try:
        return 1.0 / (1.0 + math.exp(-3.5 * (ratio - 0.7)))
    except (OverflowError, ValueError):
        # Handle extreme values
        return 1.0 if ratio > 0.7 else 0.0


def calculate_fps_factor(fps: float) -> float:
    """
    Calculate FPS bonus/penalty factor.
    
    - ≥48 fps: +8% bonus (sports, fast motion)
    - 20-48 fps: neutral (1.0)
    - <20 fps: -15% penalty (degraded/choppy)
    """
    if fps >= 48:
        return 1.08
    elif fps >= 20:
        return 1.0
    else:
        return 0.85


def calculate_quality_score(
    bitrate: float,
    codec: str,
    resolution: str,
    fps: float = 25.0
) -> int:
    """
    Calculate quality score using reference-bitrate sigmoid method.
    
    This is the main scoring function inspired by MACstrom's approach.
    
    Args:
        bitrate: Stream bitrate in kbps
        codec: Video codec (h264, hevc, av1, etc.)
        resolution: Resolution string (e.g., "1920x1080")
        fps: Frames per second (default: 25.0)
    
    Returns:
        Quality score (0-100)
    """
    # Off-air detection
    if bitrate < NOT_STREAMING_THRESHOLD:
        return 0
    
    # Get reference bitrate for this codec/resolution
    ref_bitrate = get_reference_bitrate(codec, resolution)
    
    # Calculate ratio
    ratio = bitrate / ref_bitrate
    
    # Sigmoid adequacy
    adequacy = sigmoid_adequacy(ratio)
    
    # Resolution ceiling
    resolution_tier = classify_resolution(resolution)
    ceiling = RESOLUTION_CEILINGS.get(resolution_tier, 55)
    
    # FPS factor
    fps_factor = calculate_fps_factor(fps)
    
    # Final score
    score = ceiling * adequacy * fps_factor
    
    return round(score)


def calculate_quality_score_fallback(
    resolution: str,
    fps: float = 25.0
) -> int:
    """
    Fallback scoring when bitrate is unavailable.
    
    Uses tier-based scoring with FPS adjustment.
    """
    resolution_tier = classify_resolution(resolution)
    
    # Base scores per tier (without bitrate info)
    base_scores = {
        '4k': 80,
        '1080p': 65,
        '720p': 50,
        'sd': 30,
    }
    
    base_score = base_scores.get(resolution_tier, 30)
    fps_factor = calculate_fps_factor(fps)
    
    return round(base_score * fps_factor)


def calculate_stream_score_enhanced(
    stream_data: Dict,
    use_legacy_scoring: bool = False,
    legacy_weights: Optional[Dict] = None,
    avoid_h265: bool = False
) -> float:
    """
    Enhanced stream scoring using MACstrom-inspired reference-bitrate sigmoid method.
    
    Can fallback to legacy linear scoring for backward compatibility.
    
    Args:
        stream_data: Stream analysis data with keys:
            - bitrate_kbps: Stream bitrate in kbps
            - video_codec: Codec (h264, hevc, av1, etc.)
            - resolution: Resolution string (e.g., "1920x1080")
            - fps: Frames per second
            - status: Stream status ('OK', 'Priority-Only', etc.)
        use_legacy_scoring: If True, use old linear scoring method
        legacy_weights: Legacy scoring weights (only used if use_legacy_scoring=True)
        avoid_h265: If True, penalize H.265/HEVC streams (for compatibility issues)
    
    Returns:
        Score (0.0 - 1.0 for compatibility with existing code)
        
    Scoring Methods:
        Enhanced (default): Reference-bitrate sigmoid with codec-awareness
        Legacy: Linear weighted sum (bitrate, resolution, fps, codec)
    """
    # Check if stream is dead (existing logic)
    if stream_data.get('status') not in ['OK', 'Priority-Only']:
        return 0.0
    
    # Get stream properties
    bitrate = stream_data.get('bitrate_kbps', 0)
    codec = stream_data.get('video_codec', 'h264')
    resolution = stream_data.get('resolution', '0x0')
    fps = stream_data.get('fps', 25.0)
    
    # Fallback for streams without bitrate but with resolution/FPS
    if bitrate == 0 and resolution not in ['0x0', 'N/A', ''] and fps > 0:
        if use_legacy_scoring:
            return 0.40  # Legacy fallback
        else:
            # Use fallback scoring
            score = calculate_quality_score_fallback(resolution, fps)
            # Apply HEVC penalty if avoiding
            if avoid_h265:
                normalized_codec = normalize_codec(codec)
                if normalized_codec == 'hevc':
                    score *= 0.7  # 30% penalty for HEVC
            return score / 100.0  # Normalize to 0-1
    
    # Use legacy scoring if requested
    if use_legacy_scoring:
        if not legacy_weights:
            # Default legacy weights
            legacy_weights = {
                'bitrate': 0.40,
                'resolution': 0.35,
                'fps': 0.15,
                'codec': 0.10
            }
        # Pass avoid_h265 to legacy scoring
        legacy_weights['avoid_h265'] = avoid_h265
        return _calculate_legacy_score(stream_data, legacy_weights)
    
    # Use new enhanced scoring (MACstrom-inspired)
    quality_score = calculate_quality_score(bitrate, codec, resolution, fps)
    
    # Apply HEVC penalty if avoiding (for enhanced scoring)
    if avoid_h265:
        normalized_codec = normalize_codec(codec)
        if normalized_codec == 'hevc':
            quality_score *= 0.7  # 30% penalty for HEVC
    
    # Normalize to 0-1 range for compatibility
    return quality_score / 100.0


def _calculate_legacy_score(stream_data: Dict, weights: Dict) -> float:
    """Legacy scoring method for backward compatibility."""
    score = 0.0
    
    # Bitrate score
    bitrate = stream_data.get('bitrate_kbps', 0)
    if bitrate > 0:
        bitrate_score = min(bitrate / 8000, 1.0)
        score += bitrate_score * weights.get('bitrate', 0.40)
    
    # Resolution score
    resolution = stream_data.get('resolution', 'N/A')
    resolution_score = 0.0
    if 'x' in str(resolution):
        try:
            width, height = map(int, resolution.split('x'))
            if height >= 1080:
                resolution_score = 1.0
            elif height >= 720:
                resolution_score = 0.7
            elif height >= 576:
                resolution_score = 0.5
            else:
                resolution_score = 0.3
        except (ValueError, AttributeError):
            pass
    score += resolution_score * weights.get('resolution', 0.35)
    
    # FPS score
    fps = stream_data.get('fps', 0)
    if fps > 0:
        fps_score = min(fps / 60, 1.0)
        score += fps_score * weights.get('fps', 0.15)
    
    # Codec score (respects prefer_h265 and avoid_h265 settings)
    codec = stream_data.get('video_codec', '').lower()
    codec_score = 0.0
    prefer_h265 = weights.get('prefer_h265', True)
    avoid_h265 = weights.get('avoid_h265', False)
    
    if codec:
        if 'h265' in codec or 'hevc' in codec:
            if avoid_h265:
                # Penalize H.265/HEVC
                codec_score = 0.5
            elif prefer_h265:
                # Prefer H.265/HEVC
                codec_score = 1.0
            else:
                # Neutral
                codec_score = 0.8
        elif 'h264' in codec or 'avc' in codec:
            if avoid_h265:
                # Prefer H.264 when avoiding HEVC
                codec_score = 1.0
            elif prefer_h265:
                # Lower score for H.264 when preferring HEVC
                codec_score = 0.8
            else:
                # Neutral
                codec_score = 0.8
        elif codec != 'n/a':
            codec_score = 0.5
    score += codec_score * weights.get('codec', 0.10)
    
    return round(score, 2)


# Example usage and testing
if __name__ == '__main__':
    # Test cases
    test_streams = [
        {
            'name': '1080p H.264 @ 8 Mbps, 50 FPS',
            'bitrate': 8000,
            'codec': 'h264',
            'resolution': '1920x1080',
            'fps': 50,
        },
        {
            'name': '1080p HEVC @ 4.5 Mbps, 25 FPS',
            'bitrate': 4500,
            'codec': 'hevc',
            'resolution': '1920x1080',
            'fps': 25,
        },
        {
            'name': '720p H.264 @ 4 Mbps, 25 FPS',
            'bitrate': 4000,
            'codec': 'h264',
            'resolution': '1280x720',
            'fps': 25,
        },
        {
            'name': '720p H.264 @ 8 Mbps, 50 FPS',
            'bitrate': 8000,
            'codec': 'h264',
            'resolution': '1280x720',
            'fps': 50,
        },
        {
            'name': 'Off-Air (145 kbps)',
            'bitrate': 145,
            'codec': 'h264',
            'resolution': '720x576',
            'fps': 25,
        },
    ]
    
    print("Quality Scoring Test Results:")
    print("=" * 60)
    
    for stream in test_streams:
        score = calculate_quality_score(
            stream['bitrate'],
            stream['codec'],
            stream['resolution'],
            stream['fps']
        )
        print(f"{stream['name']:40s} → Score: {score:3d}")
    
    print("=" * 60)
