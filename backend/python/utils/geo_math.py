"""
SatQuery AI - Geospatial Mathematics & Vector Utilities
Pure Python implementation for geographic distance, area calculations,
bounding box transformations, grid simulations, and GeoJSON formatting.
"""
import math
from typing import List, Dict, Any, Tuple, Optional

# Earth mean radius in kilometers (WGS84)
EARTH_RADIUS_KM = 6371.0088

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two points in kilometers."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_KM * c

def polygon_area_sq_km(coordinates: List[List[float]]) -> float:
    """
    Calculates spherical polygon area in square kilometers using Girard's theorem / Green's theorem.
    Coordinates format: [[lon1, lat1], [lon2, lat2], ...]
    """
    if len(coordinates) < 3:
        return 0.0

    # If first and last points are identical, drop the last point for calculation
    coords = coordinates[:-1] if coordinates[0] == coordinates[-1] else coordinates
    num_pts = len(coords)
    if num_pts < 3:
        return 0.0

    total_area = 0.0
    for i in range(num_pts):
        j = (i + 1) % num_pts
        lon1, lat1 = coords[i]
        lon2, lat2 = coords[j]
        
        # Spherical excess component
        rad_lon1 = math.radians(lon1)
        rad_lat1 = math.radians(lat1)
        rad_lon2 = math.radians(lon2)
        rad_lat2 = math.radians(lat2)

        total_area += (rad_lon2 - rad_lon1) * (2.0 + math.sin(rad_lat1) + math.sin(rad_lat2))

    area = math.abs(total_area * (EARTH_RADIUS_KM ** 2) / 2.0) if hasattr(math, 'abs') else abs(total_area * (EARTH_RADIUS_KM ** 2) / 2.0)
    return round(area, 4)

def bbox_to_polygon(bbox: Tuple[float, float, float, float]) -> List[List[float]]:
    """
    Converts (min_lon, min_lat, max_lon, max_lat) to closed GeoJSON polygon ring.
    """
    min_lon, min_lat, max_lon, max_lat = bbox
    return [
        [min_lon, min_lat],
        [max_lon, min_lat],
        [max_lon, max_lat],
        [min_lon, max_lat],
        [min_lon, min_lat]
    ]

def calculate_bbox_area_km2(bbox: Tuple[float, float, float, float]) -> float:
    """Calculates approximate area of a bounding box in square kilometers."""
    min_lon, min_lat, max_lon, max_lat = bbox
    width_km = haversine_distance_km(min_lat, min_lon, min_lat, max_lon)
    height_km = haversine_distance_km(min_lat, min_lon, max_lat, min_lon)
    return round(width_km * height_km, 3)

def create_geojson_feature(
    geometry_type: str,
    coordinates: Any,
    properties: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Creates a standard RFC 7946 GeoJSON Feature."""
    return {
        "type": "Feature",
        "geometry": {
            "type": geometry_type,
            "coordinates": coordinates
        },
        "properties": properties or {}
    }

def create_feature_collection(features: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Creates a standard GeoJSON FeatureCollection."""
    return {
        "type": "FeatureCollection",
        "features": features
    }
