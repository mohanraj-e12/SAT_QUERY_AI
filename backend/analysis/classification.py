"""
SatQueryAI - Scene & Land Cover Classification
Executes classification via CLIP and Vision Transformer (ViT).
"""

from typing import Dict, Any, List
try:
    from backend.preprocessing.image_utils import load_image_to_pil
    from backend.models.vit_model import vit_adapter
    from backend.models.clip_model import clip_adapter
except ImportError:
    from preprocessing.image_utils import load_image_to_pil
    from models.vit_model import vit_adapter
    from models.clip_model import clip_adapter


def classify_scene(image_input: Any, custom_labels: List[str] = None) -> Dict[str, Any]:
    """
    Performs dual-head classification:
    1. Vision Transformer Corine Land Cover (CLC-19) partition
    2. CLIP zero-shot ranking against candidate categories
    """
    pil_img = load_image_to_pil(image_input)

    # 1. ViT classification
    vit_res = vit_adapter.classify_land_cover(pil_img)

    # 2. CLIP classification
    labels = custom_labels or [
        "Dense Urban and Commercial Buildings",
        "Agricultural Crop Fields",
        "Water Reservoir and Rivers",
        "Dense Natural Forest Canopy",
        "Industrial Zone",
        "Coastal Wetland",
    ]
    clip_res = clip_adapter.zero_shot_classify(pil_img, labels)

    return {
        "primary_class": vit_res["primary_class"],
        "confidence": vit_res["confidence"],
        "clc_code": vit_res.get("clc_code", "CLC-19"),
        "vit_evaluation": vit_res,
        "clip_zero_shot": clip_res,
        "evidence_type": vit_res.get("evidence_type", "CALIBRATED_ANALYTICAL_PARTITION"),
    }
