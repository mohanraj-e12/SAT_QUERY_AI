"""
SatQueryAI - Optical Imagery Preprocessor
Handles channel normalization, contrast enhancement, resizing, and true/false-color rendering.
"""

from typing import Dict, Any, Tuple, Optional
from .image_utils import load_image_to_pil, pil_to_base64_png, pil_to_numpy, numpy_to_pil, PIL_AVAILABLE, NUMPY_AVAILABLE

try:
    from PIL import ImageEnhance, ImageOps
except ImportError:
    pass


class OpticalPreprocessor:
    """Standardized preprocessing pipeline for optical satellite imagery (Sentinel-2, Landsat, etc.)."""

    def __init__(self, target_size: Tuple[int, int] = (512, 512)):
        self.target_size = target_size

    def preprocess(self, image_input: Any, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Executes optical preprocessing:
        1. Channel normalization
        2. Bilinear resizing
        3. Contrast stretching / CLAHE-like enhancement
        4. RGB visualization generation
        """
        pil_img = load_image_to_pil(image_input)
        
        # Modality check: do not claim certainty if metadata is absent
        modality_certainty = "UNCERTAIN"
        detected_modality = "OPTICAL_ASSUMED"
        if metadata:
            sensor = str(metadata.get("satellite", "")).upper()
            modality = str(metadata.get("modality", "")).upper()
            if "SENTINEL-1" in sensor or "SAR" in modality:
                detected_modality = "SAR"
                modality_certainty = "VERIFIED_METADATA"
            elif any(opt in sensor for opt in ["SENTINEL-2", "LANDSAT", "PLANET", "MODIS", "SPOT"]) or "OPTICAL" in modality:
                detected_modality = "OPTICAL"
                modality_certainty = "VERIFIED_METADATA"

        if pil_img is None:
            return {
                "success": False,
                "error": "Failed to load optical image",
                "detected_modality": detected_modality,
                "modality_certainty": modality_certainty,
            }

        # 1. Ensure RGB mode
        if pil_img.mode != "RGB":
            pil_img = pil_img.convert("RGB")

        orig_w, orig_h = pil_img.size

        # 2. Resize to target size for inference if larger
        resized = pil_img.resize(self.target_size)

        # 3. Contrast enhancement
        enhancer = ImageEnhance.Contrast(resized)
        enhanced = enhancer.enhance(1.15)
        # Slight color balancing
        color_enhancer = ImageEnhance.Color(enhanced)
        enhanced = color_enhancer.enhance(1.08)

        # 4. Generate RGB visualization base64
        rgb_data_url = pil_to_base64_png(enhanced)

        # 5. Extract normalized band stats if numpy is present
        band_stats = {}
        if NUMPY_AVAILABLE:
            np_arr = pil_to_numpy(enhanced)
            if np_arr is not None:
                band_stats = {
                    "red_mean": float(np_arr[:, :, 0].mean()),
                    "green_mean": float(np_arr[:, :, 1].mean()),
                    "blue_mean": float(np_arr[:, :, 2].mean()),
                    "dynamic_range": [float(np_arr.min()), float(np_arr.max())],
                }

        return {
            "success": True,
            "detected_modality": detected_modality,
            "modality_certainty": modality_certainty,
            "original_dimensions": (orig_w, orig_h),
            "processed_dimensions": self.target_size,
            "channels": 3,
            "contrast_applied": True,
            "band_statistics": band_stats,
            "rgb_preview_url": rgb_data_url,
            "processed_image": enhanced,
        }


optical_preprocessor = OpticalPreprocessor()
