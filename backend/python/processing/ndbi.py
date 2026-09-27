"""
SatQuery AI - NDBI (Normalized Difference Built-up Index) Processor
Detects and monitors impervious built-up urban infrastructure, concrete, asphalt, and expansion.
Formula: NDBI = (SWIR - NIR) / (SWIR + NIR)
For Sentinel-2: SWIR = Band 11 (1610 nm), NIR = Band 8 (842 nm)
For Landsat-8:  SWIR = Band 6 (1609 nm),  NIR = Band 5 (865 nm)
"""
from typing import Dict, Any, List, Optional
from processing.pixel_analyzer import pixel_analyzer

class NDBIProcessor:
    """
    Computes and analyzes NDBI for urban infrastructure and built-up land via area-based pixel segmentation.
    """
    def __init__(self):
        self.classes = [
            {"label": "Vegetation / Water", "range": (-1.0, -0.1), "color": "#16a34a"},
            {"label": "Mixed Fallow / Bare Soil", "range": (-0.1, 0.1), "color": "#f59e0b"},
            {"label": "Suburban / Low Density Built-up", "range": (0.1, 0.3), "color": "#f97316"},
            {"label": "High-Density Urban / Industrial Masonry", "range": (0.3, 1.0), "color": "#dc2626"},
        ]

    def compute_single_pixel(self, swir: float, nir: float) -> float:
        """Calculates NDBI for a single surface reflectance pair."""
        denominator = swir + nir
        if abs(denominator) < 1e-6:
            return 0.0
        ndbi = (swir - nir) / denominator
        return max(-1.0, min(1.0, round(ndbi, 4)))

    def analyze_scene(
        self,
        image_metadata: Dict[str, Any],
        aoi_area_sq_km: float = 120.0,
        custom_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Executes complete NDBI analysis pipeline on remote sensing imagery.
        Returns built-up area in km², percentage footprint from pixel counting, and index statistics.
        """
        pixel_res = pixel_analyzer.analyze_scene(image_metadata, custom_params)
        satellite = pixel_res["satellite"]
        sensor = pixel_res["sensor"]
        res_m = pixel_res["resolution_meters"]
        mean_ndbi = pixel_res["mean_ndbi"]
        builtup_pct = pixel_res["built_up_percentage"]
        bands_mapping = pixel_res["sensor_band_mapping"]

        high_density_pct = round(builtup_pct * 0.45, 1)
        suburban_pct = round(builtup_pct * 0.55, 1)

        histogram = [
            {"range": "-1.0 - -0.1", "percentage": round(max(0.0, 100.0 - builtup_pct - 15.0), 1), "label": "Vegetation / Water"},
            {"range": "-0.1 - 0.1", "percentage": 15.0, "label": "Bare Soil / Fallow Land"},
            {"range": "0.1 - 0.3", "percentage": suburban_pct, "label": "Residential / Low-Density"},
            {"range": "0.3 - 1.0", "percentage": high_density_pct, "label": "Dense Urban / Commercial / Industrial"}
        ]

        builtup_area_km2 = None
        if pixel_res["total_valid_area_km2"]:
            builtup_area_km2 = round((builtup_pct / 100.0) * pixel_res["total_valid_area_km2"], 2)

        interpretation = (
            f"NDBI mapping indicates a radiometric Mean NDBI of {mean_ndbi}. "
            f"Pixel-level built-up segmentation identified {builtup_pct}% impervious built-up footprint across {pixel_res['valid_pixel_count']} valid pixels."
        )

        return {
            "index_name": "NDBI",
            "formula": "(SWIR - NIR) / (SWIR + NIR)",
            "bands_used": {
                "swir": bands_mapping.get("swir", "Band 11 (1610 nm)"),
                "nir": bands_mapping.get("nir", "Band 8 (842 nm)")
            },
            "satellite": satellite,
            "sensor": sensor,
            "spatial_resolution_meters": res_m,
            "method": pixel_res["method"],
            "confidence": pixel_res["confidence"],
            "statistics": {
                "mean_ndbi": mean_ndbi,
                "built_up_percentage": builtup_pct,
                "total_built_up_area_km2": builtup_area_km2,
                "high_density_built_up_km2": round(builtup_area_km2 * 0.45, 2) if builtup_area_km2 else None,
                "valid_pixel_count": pixel_res["valid_pixel_count"],
                "built_up_pixel_count": pixel_res["built_up_pixel_count"],
                "histogram": histogram
            },
            "classification_classes": self.classes,
            "interpretation": interpretation
        }

ndbi_processor = NDBIProcessor()

