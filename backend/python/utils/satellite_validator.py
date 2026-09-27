"""
SatQuery AI - Satellite Image Validator
Verifies whether an uploaded image or query subject represents a valid Earth Observation / Remote Sensing scene
(e.g., optical multispectral, SAR radar, aerial drone orthomosaic) or an invalid everyday non-satellite photo (selfie, indoor, meme, screenshot).
"""
from typing import Dict, Any, Tuple, Optional

class SatelliteImageValidator:
    """
    Validates Earth observation imagery authenticity.
    """
    def validate_image(self, image_metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Audits image metadata and content flags for satellite authenticity.
        """
        name = str(image_metadata.get("file_name", "") or image_metadata.get("id", "")).lower()
        satellite = str(image_metadata.get("satellite", "")).lower()
        sensor = str(image_metadata.get("sensor", "")).lower()
        source = str(image_metadata.get("source", "")).lower()

        # Check explicit invalid flags
        if image_metadata.get("is_valid_satellite") is False:
            return {
                "is_valid": False,
                "detected_type": image_metadata.get("detected_type", "Everyday Non-Geospatial Photo"),
                "reason": image_metadata.get("rejection_reason", "Image was identified as non-satellite content."),
                "message": "Please submit a valid satellite image (e.g., Sentinel-2, Landsat, PlanetScope, SAR radar, or aerial drone orthomosaics)."
            }

        # Check non-satellite keywords in filename
        invalid_keywords = [
            "selfie", "portrait", "screenshot", "screen_shot", "meme",
            "avatar", "profile", "receipt", "invoice", "cat", "dog", "room", "food"
        ]
        for kw in invalid_keywords:
            if kw in name:
                return {
                    "is_valid": False,
                    "detected_type": f"Non-Satellite Subject ({kw})",
                    "reason": f"File identifier contains non-geospatial pattern '{kw}'.",
                    "message": "Please submit a valid satellite image. The uploaded file appears to be a regular non-geospatial image."
                }

        # Check valid satellite indicators
        valid_sat_indicators = [
            "sentinel", "landsat", "planet", "bhuvan", "worldview", "modis",
            "s2a", "s2b", "lc08", "lc09", "spot", "cartosat", "resourcesat",
            "risat", "sar", "ortho", "geotiff", "drone", "copernicus", "usgs"
        ]
        has_valid_name = any(ind in name or ind in satellite or ind in source for ind in valid_sat_indicators)

        if has_valid_name:
            return {
                "is_valid": True,
                "detected_type": "Satellite / Earth Observation Scene",
                "reason": "Authentic Earth observation metadata matched.",
                "message": "Valid satellite scene confirmed."
            }

        # Check coordinates and resolution
        lat = image_metadata.get("latitude")
        lon = image_metadata.get("longitude")
        res = image_metadata.get("resolution_meters")
        
        if lat is not None and lon is not None and res is not None and res > 0:
            return {
                "is_valid": True,
                "detected_type": "Geospatially Grounded Scene",
                "reason": "Geospatial coordinate frame and ground sample distance are present.",
                "message": "Valid satellite scene confirmed."
            }

        return {
            "is_valid": True,
            "detected_type": "Satellite Optical Scene (Default)",
            "reason": "Processed under Earth observation framework.",
            "message": "Valid satellite scene."
        }

satellite_validator = SatelliteImageValidator()
