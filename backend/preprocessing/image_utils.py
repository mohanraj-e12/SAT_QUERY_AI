"""
SatQueryAI - Preprocessing Image Utilities
Handles robust image reading, format validation, and byte conversions.
"""

import io
import base64
from typing import Tuple, Optional, Any, Dict

try:
    from PIL import Image, ImageOps, ImageEnhance
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False


def load_image_to_pil(data_or_path: Any) -> Optional[Any]:
    """Loads image bytes, filepath, or base64 into a PIL.Image object."""
    if not PIL_AVAILABLE:
        return None

    if isinstance(data_or_path, Image.Image):
        return data_or_path.copy()

    if isinstance(data_or_path, str):
        # Check if base64 data URI
        if data_or_path.startswith("data:image"):
            b64 = data_or_path.split(",", 1)[1]
            raw = base64.b64decode(b64)
            return Image.open(io.BytesIO(raw))
        # Check if local file
        return Image.open(data_or_path)

    if isinstance(data_or_path, bytes):
        return Image.open(io.BytesIO(data_or_path))

    return None


def pil_to_base64_png(image: Any) -> str:
    """Converts a PIL Image to a base64 PNG data URL."""
    if not PIL_AVAILABLE or image is None:
        return ""
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64}"


def pil_to_numpy(image: Any) -> Optional[Any]:
    """Converts PIL image to float32 NumPy array normalized to [0, 1]."""
    if not (PIL_AVAILABLE and NUMPY_AVAILABLE) or image is None:
        return None
    arr = np.array(image, dtype=np.float32)
    if arr.max() > 1.0:
        arr /= 255.0
    return arr


def numpy_to_pil(arr: Any) -> Optional[Any]:
    """Converts NumPy array back to PIL uint8 image."""
    if not (PIL_AVAILABLE and NUMPY_AVAILABLE) or arr is None:
        return None
    clipped = np.clip(arr * 255.0 if arr.max() <= 1.0 else arr, 0, 255).astype(np.uint8)
    return Image.fromarray(clipped)
