"""
SatQueryAI GeoScope - Raster & Imagery Clipping Module
Crops and masks multispectral satellite rasters to user-specified AOI geometries.
"""

from typing import Dict, Any, Tuple, Optional
from backend.utils.image_utils import StandardImage, extract_visual_features

class ImageryClipper:
    """
    Clips imagery to bounding box and polygon coordinates.
    """

    def clip_to_bounds(
        self,
        image_obj: Any,
        aoi_bounds: Tuple[float, float, float, float],
        target_bounds: Tuple[float, float, float, float]
    ) -> Any:
        """
        Clips sub-region corresponding to target_bounds from image_obj spanning aoi_bounds.
        """
        if not image_obj:
            return None

        w, h = image_obj.size
        min_lon, min_lat, max_lon, max_lat = aoi_bounds
        t_min_lon, t_min_lat, t_max_lon, t_max_lat = target_bounds

        lon_span = max(1e-6, max_lon - min_lon)
        lat_span = max(1e-6, max_lat - min_lat)

        # Pixel mapping
        x1 = max(0, min(w - 1, int(((t_min_lon - min_lon) / lon_span) * w)))
        x2 = max(x1 + 1, min(w, int(((t_max_lon - min_lon) / lon_span) * w)))
        y1 = max(0, min(h - 1, int(((max_lat - t_max_lat) / lat_span) * h)))
        y2 = max(y1 + 1, min(h, int(((max_lat - t_min_lat) / lat_span) * h)))

        clipped = image_obj.crop((x1, y1, x2, y2))
        return clipped

imagery_clipper = ImageryClipper()
