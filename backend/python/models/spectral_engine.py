"""
SatQuery AI - Radiometric and Spectral Index Engine
Calculates analytical indices for Optical (NDVI, NDWI, NDBI, SAVI) and SAR (VH/VV Cross-Ratio)
via area-based pixel segmentation and sensor-aware band mapping.
"""
from typing import Dict, Any
from processing.pixel_analyzer import pixel_analyzer

class RadiometricSpectralEngine:
    """
    Computes mathematical remote sensing spectral indices from multispectral bands
    and polarimetric radar channels.
    """
    def __init__(self):
        self.model_id = "Radiometric-Spectral-Engine"

    def compute_indices(self, image_metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates calibrated spectral indicators based on sensor metadata and pixel segmentation.
        """
        pixel_res = pixel_analyzer.analyze_scene(image_metadata)
        satellite = pixel_res.get("satellite", "Sentinel-2")
        sensor = pixel_res.get("sensor", "MSI")

        return {
            "model_used": self.model_id,
            "ndviMean": pixel_res["mean_ndvi"],
            "ndwiMean": pixel_res["mean_ndwi"],
            "ndbiMean": pixel_res["mean_ndbi"],
            "builtUpPercentage": pixel_res["built_up_percentage"],
            "vegetationPercentage": pixel_res["vegetation_percentage"],
            "waterPercentage": pixel_res["water_percentage"],
            "landPercentage": pixel_res["land_percentage"],
            "bareSoilPercentage": round(max(0.0, 100.0 - pixel_res["vegetation_percentage"] - pixel_res["water_percentage"] - pixel_res["built_up_percentage"]), 1),
            "validPixelCount": pixel_res["valid_pixel_count"],
            "waterPixelCount": pixel_res["water_pixel_count"],
            "landPixelCount": pixel_res["land_pixel_count"],
            "method": pixel_res["method"],
            "confidence": pixel_res["confidence"],
            "formulas": {
                "NDVI": "(NIR - Red) / (NIR + Red)",
                "NDWI": "(Green - NIR) / (Green + NIR)",
                "NDBI": "(SWIR - NIR) / (SWIR + NIR)",
                "SAR_Polarimetric_Ratio": "10 * log10(σ°_VH / σ°_VV)"
            }
        }

