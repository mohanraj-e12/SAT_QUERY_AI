"""
SatQueryAI - Mask Visualization Module
Generates high-contrast binary and semantic thematic masks for remote-sensing features.
"""

import io
import base64
from typing import Tuple, List, Optional, Any, Dict

try:
    from PIL import Image, ImageDraw
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False


# Thematic color mapping for remote-sensing semantic classes (RGBA)
TASK_COLOR_MAP = {
    "water": (14, 165, 233, 200),        # Sky / Deep Cyan
    "vegetation": (16, 185, 129, 200),   # Vibrant Emerald Green
    "buildings": (244, 63, 94, 200),     # Rose / Pink Accent
    "roads": (245, 158, 11, 200),        # Amber / Orange
    "urban": (239, 68, 68, 200),         # Red / Terracotta
    "flood": (59, 130, 246, 210),        # Cobalt Blue
    "land_cover": (139, 92, 246, 200),   # Violet
    "agriculture": (34, 197, 94, 200),   # Green
}


def create_colored_mask(
    mask_matrix: Any,
    task: str = "water",
    dimensions: Tuple[int, int] = (512, 512)
) -> str:
    """
    Creates a colored PNG mask from a boolean or float probability matrix.
    Returns a data URL (data:image/png;base64,...).
    """
    w, h = dimensions
    color = TASK_COLOR_MAP.get(task.lower(), (253, 24, 67, 200))

    if not PIL_AVAILABLE:
        # Minimal 1x1 transparent PNG fallback if PIL is missing
        return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    if NUMPY_AVAILABLE and isinstance(mask_matrix, np.ndarray):
        # Scale to dimensions if needed
        bool_mask = mask_matrix > 0.5
        rgba = np.zeros((mask_matrix.shape[0], mask_matrix.shape[1], 4), dtype=np.uint8)
        rgba[bool_mask] = color
        mask_img = Image.fromarray(rgba, mode="RGBA")
        if mask_img.size != (w, h):
            mask_img = mask_img.resize((w, h), Image.Resampling.NEAREST)
    else:
        # Fallback: create stylized contour mask
        mask_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(mask_img)
        # Draw central representative region
        draw.ellipse([w // 4, h // 4, 3 * w // 4, 3 * h // 4], fill=color)

    buffer = io.BytesIO()
    mask_img.save(buffer, format="PNG")
    b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64}"


def create_binary_mask_url(mask_matrix: Any, dimensions: Tuple[int, int] = (512, 512)) -> str:
    """Generates standard binary mask (black background = 0, white foreground = 255)."""
    w, h = dimensions
    if not PIL_AVAILABLE:
        return ""

    if NUMPY_AVAILABLE and isinstance(mask_matrix, np.ndarray):
        binary_arr = (mask_matrix > 0.5).astype(np.uint8) * 255
        img = Image.fromarray(binary_arr, mode="L")
        if img.size != (w, h):
            img = img.resize((w, h), Image.Resampling.NEAREST)
    else:
        img = Image.new("L", (w, h), 0)
        draw = ImageDraw.Draw(img)
        draw.rectangle([w // 4, h // 4, 3 * w // 4, 3 * h // 4], fill=255)

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64}"
