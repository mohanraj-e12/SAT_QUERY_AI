"""
SatQueryAI - Overlay Visualization Module
Blends semantic segmentation masks and draws geo-referenced bounding boxes onto satellite scenes.
"""

import io
import base64
from typing import List, Dict, Any, Tuple, Optional
try:
    from backend.preprocessing.image_utils import load_image_to_pil, PIL_AVAILABLE
except ImportError:
    from preprocessing.image_utils import load_image_to_pil, PIL_AVAILABLE

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    pass


def create_blended_overlay(
    original_image: Any,
    mask_matrix: Any,
    task: str = "water",
    opacity: float = 0.45,
    bounding_boxes: Optional[List[Dict[str, Any]]] = None
) -> str:
    """
    Creates a composite visualization:
    1. Base satellite image
    2. Transparent colored segmentation mask
    3. Bounding boxes & confidence tags for detected targets
    Returns base64 PNG data URL.
    """
    if not PIL_AVAILABLE:
        return ""

    base_pil = load_image_to_pil(original_image)
    if base_pil is None:
        base_pil = Image.new("RGB", (512, 512), (30, 41, 59))
    else:
        base_pil = base_pil.convert("RGBA")

    w, h = base_pil.size

    # 1. Generate colored overlay layer
    from .masks import create_colored_mask
    mask_data_url = create_colored_mask(mask_matrix, task=task, dimensions=(w, h))
    if mask_data_url.startswith("data:image/png;base64,"):
        raw_mask_bytes = base64.b64decode(mask_data_url.split(",", 1)[1])
        mask_pil = Image.open(io.BytesIO(raw_mask_bytes)).convert("RGBA")
        
        # Adjust opacity
        r, g, b, alpha = mask_pil.split()
        alpha = alpha.point(lambda p: int(p * opacity))
        mask_pil.putalpha(alpha)
        
        # Composite
        composite = Image.alpha_composite(base_pil, mask_pil)
    else:
        composite = base_pil

    # 2. Draw Bounding Boxes if provided
    draw = ImageDraw.Draw(composite)
    if bounding_boxes:
        for idx, box in enumerate(bounding_boxes):
            # Normalize to current image dimensions if in [0, 1]
            coords = box.get("box", box.get("bbox", [0.1, 0.1, 0.3, 0.3]))
            label = box.get("label", f"Target #{idx+1}")
            conf = box.get("confidence", 0.90)

            # Check if coords are normalized [0, 1] or pixel absolute
            if all(0.0 <= c <= 1.0 for c in coords):
                x1 = int(coords[0] * w)
                y1 = int(coords[1] * h)
                x2 = int(coords[2] * w)
                y2 = int(coords[3] * h)
            else:
                x1, y1, x2, y2 = int(coords[0]), int(coords[1]), int(coords[2]), int(coords[3])

            # Draw outer rectangle and inner border for high contrast
            draw.rectangle([x1, y1, x2, y2], outline=(253, 24, 67, 255), width=2)
            draw.rectangle([x1 - 1, y1 - 1, x2 + 1, y2 + 1], outline=(255, 255, 255, 180), width=1)

            # Draw label tag
            tag_text = f"{label} ({int(conf * 100)}%)" if isinstance(conf, (int, float)) else label
            tag_w = len(tag_text) * 7 + 8
            tag_h = 16
            draw.rectangle([x1, max(0, y1 - tag_h), x1 + tag_w, max(0, y1)], fill=(253, 24, 67, 230))
            draw.text((x1 + 4, max(0, y1 - tag_h) + 2), tag_text, fill=(255, 255, 255, 255))

    buffer = io.BytesIO()
    composite.convert("RGB").save(buffer, format="JPEG", quality=92)
    b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"
