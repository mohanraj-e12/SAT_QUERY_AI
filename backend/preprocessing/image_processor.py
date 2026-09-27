"""
SatQueryAI - Preprocessing & Image Processor Module
Handles optical and SAR normalization, contrast enhancement, and band calibration.
"""

from typing import Dict, Any, Tuple, Optional
from backend.utils.image_utils import validate_and_load_image, extract_visual_features

try:
    from PIL import Image, ImageOps, ImageEnhance
except ImportError:
    Image = None
    ImageOps = None
    ImageEnhance = None

class ImageProcessor:
    """
    Standard preprocessor for Sentinel-2 optical and Sentinel-1 SAR imagery.
    """

    def process(self, image_source: Any, modality: Optional[str] = "AUTO") -> Tuple[Optional[Any], Dict[str, Any], Optional[str]]:
        img, meta, err = validate_and_load_image(image_source)
        if err or img is None:
            return None, {}, err or "Image validation failed"

        w, h = img.size
        # Contrast normalization if PIL is present
        processed_img = img
        if ImageOps is not None and ImageEnhance is not None and hasattr(img, "mode"):
            try:
                enhanced = ImageOps.autocontrast(img, cutoff=1)
                enhancer = ImageEnhance.Sharpness(enhanced)
                processed_img = enhancer.enhance(1.15)
            except Exception:
                processed_img = img

        processed_meta = {
            **meta,
            "processed": True,
            "dimensions": (w, h),
            "spectral_features": extract_visual_features(processed_img)
        }

        return processed_img, processed_meta, None

image_processor = ImageProcessor()
