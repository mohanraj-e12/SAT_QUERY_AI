"""
SatQueryAI GeoScope - Area of Interest (AOI) Management
Parses, validates, and calculates metrics for user-demarcated geographic areas.
"""

from typing import Dict, Any, List, Optional
from backend.geospatial.projection import calculate_polygon_area_km2, calculate_bbox_and_center

class AOIManager:
    """
    Validates and analyzes Area of Interest (AOI) GeoJSON geometries.
    """

    def process_aoi_geometry(self, geometry: Dict[str, Any]) -> Dict[str, Any]:
        if not geometry or not isinstance(geometry, dict):
            return {
                "valid": False,
                "error": "Invalid geometry structure. Expected GeoJSON dict.",
                "area_km2": 0.0
            }

        geom_type = geometry.get("type", "")
        coords = geometry.get("coordinates", [])

        if geom_type == "Polygon" and coords:
            ring = coords[0]
            area_km2 = calculate_polygon_area_km2(ring)
            bounds, center = calculate_bbox_and_center(ring)
        elif geom_type == "MultiPolygon" and coords:
            total_area = 0.0
            all_pts = []
            for poly in coords:
                if poly:
                    total_area += calculate_polygon_area_km2(poly[0])
                    all_pts.extend(poly[0])
            area_km2 = round(total_area, 4)
            bounds, center = calculate_bbox_and_center(all_pts)
        elif geom_type == "Point" and coords:
            bounds = [coords[0], coords[1], coords[0], coords[1]]
            center = {"lat": coords[1], "lon": coords[0]}
            area_km2 = 0.0
        else:
            return {
                "valid": False,
                "error": f"Unsupported geometry type: {geom_type}",
                "area_km2": 0.0
            }

        # Format standardized GeoJSON feature
        geojson_feature = {
            "type": "Feature",
            "properties": {
                "area_km2": area_km2,
                "center": center,
                "bounds": bounds,
                "crs": "EPSG:4326"
            },
            "geometry": geometry
        }

        return {
            "valid": True,
            "area_km2": area_km2,
            "center": center,
            "bounds": bounds,
            "geometry": geometry,
            "geojson": geojson_feature,
            "status": "ready"
        }

aoi_manager = AOIManager()
