"""
SatQuery AI - GIS (Geographic Information System) Agent
Handles geospatial geometry, AOI area calculations (km² / hectares), buffers,
intersections, vector feature generation, and GeoJSON formatting.
"""
from typing import Dict, Any, List, Optional, Tuple
from utils.geo_math import (
    polygon_area_sq_km,
    calculate_bbox_area_km2,
    bbox_to_polygon,
    create_geojson_feature,
    create_feature_collection,
    haversine_distance_km
)

class GISAgent:
    """
    Executes vector and raster GIS operations on user AOIs and detected geospatial entities.
    """
    def process_aoi(
        self,
        aoi_data: Optional[Dict[str, Any]] = None,
        default_bbox: Optional[Tuple[float, float, float, float]] = None
    ) -> Dict[str, Any]:
        """
        Parses AOI input (GeoJSON or Bounding Box) and computes geodesic area and center.
        """
        if aoi_data and aoi_data.get("type") == "Polygon":
            coordinates = aoi_data.get("coordinates", [[]])[0]
            area_km2 = polygon_area_sq_km(coordinates)
            if area_km2 < 0.1 and coordinates:
                # Approximate bounding box area fallback if coordinates are local
                lons = [c[0] for c in coordinates]
                lats = [c[1] for c in coordinates]
                area_km2 = calculate_bbox_area_km2((min(lons), min(lats), max(lons), max(lats)))
            polygon = coordinates
        elif default_bbox:
            area_km2 = calculate_bbox_area_km2(default_bbox)
            polygon = bbox_to_polygon(default_bbox)
        else:
            # Standard regional default (approx 120 km²)
            area_km2 = 120.0
            polygon = bbox_to_polygon((77.10, 28.50, 77.30, 28.70))

        area_ha = round(area_km2 * 100.0, 1)

        return {
            "agent": "GISAgent",
            "aoi_area_sq_km": area_km2,
            "aoi_area_hectares": area_ha,
            "aoi_polygon": polygon,
            "crs": "EPSG:4326 (WGS84)",
            "geojson": create_geojson_feature("Polygon", [polygon], {
                "name": "User AOI Boundary",
                "area_km2": area_km2,
                "area_ha": area_ha
            })
        }

    def generate_buffer(self, lat: float, lon: float, radius_km: float = 2.0) -> Dict[str, Any]:
        """
        Generates circular polygon buffer around a coordinate in kilometers.
        """
        import math
        points: List[List[float]] = []
        num_segments = 32
        d_lat = radius_km / 111.32
        d_lon = radius_km / (111.32 * math.cos(math.radians(lat)))

        for i in range(num_segments + 1):
            theta = 2.0 * math.pi * (i / num_segments)
            p_lat = lat + d_lat * math.sin(theta)
            p_lon = lon + d_lon * math.cos(theta)
            points.append([round(p_lon, 5), round(p_lat, 5)])

        buffer_area = round(math.pi * (radius_km ** 2), 2)
        return {
            "buffer_radius_km": radius_km,
            "buffer_area_km2": buffer_area,
            "coordinates": [points],
            "geojson": create_geojson_feature("Polygon", [points], {
                "type": "Geospatial Buffer",
                "radius_km": radius_km,
                "center": [lon, lat]
            })
        }

    def detections_to_geojson(self, detections: List[Dict[str, Any]], base_bbox: Tuple[float, float, float, float]) -> Dict[str, Any]:
        """
        Converts detections (either polygon geometries or normalized 2D bounding boxes) into georeferenced GeoJSON.
        """
        min_lon, min_lat, max_lon, max_lat = base_bbox
        features: List[Dict[str, Any]] = []

        for det in detections:
            poly = None
            if det.get("polygon") and isinstance(det["polygon"], list) and len(det["polygon"]) >= 3:
                # Direct geographic coordinates [[lon, lat], ...]
                poly = det["polygon"]
            elif det.get("box_2d"):
                box = det.get("box_2d", [0.0, 0.0, 1.0, 1.0])
                ymin, xmin, ymax, xmax = box

                det_min_lon = min_lon + xmin * (max_lon - min_lon)
                det_max_lon = min_lon + xmax * (max_lon - min_lon)
                det_min_lat = max_lat - ymax * (max_lat - min_lat)
                det_max_lat = max_lat - ymin * (max_lat - min_lat)

                poly = bbox_to_polygon((det_min_lon, det_min_lat, det_max_lon, det_max_lat))

            if poly:
                features.append(create_geojson_feature("Polygon", [poly], {
                    "id": det.get("id"),
                    "label": det.get("label"),
                    "category": det.get("category"),
                    "confidence": det.get("confidence"),
                    "area_sq_m": det.get("area_sq_m"),
                    "area_ha": det.get("area_ha"),
                    "modality_evidence": det.get("modality_evidence")
                }))

        return create_feature_collection(features)

gis_agent = GISAgent()
