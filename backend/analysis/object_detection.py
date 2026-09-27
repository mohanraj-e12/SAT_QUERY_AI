"""
SatQueryAI - Object Detection & Spatial Grounding
Delineates localized features, bounding boxes, and region polygons.
"""

from typing import Dict, Any, List
try:
    from backend.preprocessing.image_utils import load_image_to_pil, pil_to_numpy
    from backend.models.sam_model import sam_adapter
except ImportError:
    from preprocessing.image_utils import load_image_to_pil, pil_to_numpy
    from models.sam_model import sam_adapter


def detect_objects(image_input: Any, prompt_target: str = "buildings") -> Dict[str, Any]:
    """
    Performs object detection using SAM adapter.
    Returns detected count, bounding boxes, mean confidence, and spatial regions.
    """
    pil_img = load_image_to_pil(image_input)
    dims = pil_img.size if pil_img else (512, 512)
    np_img = pil_to_numpy(pil_img)

    sam_res = sam_adapter.segment_objects(
        image_np=np_img,
        prompt_category=prompt_target,
        dimensions=dims
    )

    return {
        "target": prompt_target,
        "count": sam_res["detected_objects_count"],
        "bounding_boxes": sam_res["bounding_boxes"],
        "mean_confidence": sam_res["mean_confidence"],
        "algorithm": sam_res["algorithm"],
        "latency_ms": sam_res["latency_ms"],
        "evidence_type": sam_res.get("evidence_type", "CALCULATED_REGION_CONTOURS"),
    }
