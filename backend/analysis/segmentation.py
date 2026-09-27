"""
SatQueryAI - Segmentation Pipeline
Implements the generic segment_image(image, task) interface supporting:
water, vegetation, buildings, roads, urban, flood, land_cover.
"""

from typing import Dict, Any, Optional
import time

try:
    from backend.preprocessing.image_utils import load_image_to_pil, pil_to_numpy
    from backend.models.unet_model import unet_adapter
    from backend.visualization.masks import create_colored_mask
except ImportError:
    from preprocessing.image_utils import load_image_to_pil, pil_to_numpy
    from models.unet_model import unet_adapter
    from visualization.masks import create_colored_mask


SUPPORTED_SEGMENTATION_TASKS = [
    "water",
    "vegetation",
    "buildings",
    "roads",
    "urban",
    "flood",
    "land_cover",
]


def segment_image(image_input: Any, task: str) -> Dict[str, Any]:
    """
    Generic segmentation interface strictly meeting FEATURE 5:
    segment_image(image, task)

    Supported tasks:
    - water
    - vegetation
    - buildings
    - roads
    - urban
    - flood
    - land_cover

    Returns:
    {
      "task": "water",
      "mask_url": "...",
      "coverage_percentage": 34.7,
      "confidence": 0.91
    }
    """
    clean_task = task.lower().strip()
    if clean_task not in SUPPORTED_SEGMENTATION_TASKS:
        # Graceful normalization
        if "water" in clean_task or "river" in clean_task or "lake" in clean_task:
            clean_task = "water"
        elif "veg" in clean_task or "forest" in clean_task or "crop" in clean_task:
            clean_task = "vegetation"
        elif "build" in clean_task or "house" in clean_task or "struct" in clean_task:
            clean_task = "buildings"
        elif "road" in clean_task or "street" in clean_task or "highway" in clean_task:
            clean_task = "roads"
        elif "flood" in clean_task or "inundat" in clean_task:
            clean_task = "flood"
        elif "urban" in clean_task or "city" in clean_task:
            clean_task = "urban"
        else:
            clean_task = "land_cover"

    pil_img = load_image_to_pil(image_input)
    dims = pil_img.size if pil_img else (512, 512)
    np_img = pil_to_numpy(pil_img)

    # 1. Run U-Net semantic segmentation
    pred = unet_adapter.predict_mask(np_img, task=clean_task, dimensions=dims)

    # 2. Generate colored mask URL
    mask_url = create_colored_mask(pred.get("mask_matrix"), task=clean_task, dimensions=dims)

    return {
        "task": clean_task,
        "mask_url": mask_url,
        "coverage_percentage": pred["coverage_percentage"],
        "confidence": pred["confidence"],
        "total_pixels": pred.get("total_pixels", dims[0] * dims[1]),
        "detected_pixels": pred.get("detected_pixels", int(dims[0] * dims[1] * (pred["coverage_percentage"] / 100.0))),
    }
