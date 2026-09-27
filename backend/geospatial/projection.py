"""
SatQueryAI GeoScope - Projection & Geodesic Calculation Module
Computes accurate geodesic surface area in km², center points, and bounding boxes.
"""

import math
from typing import List, Tuple, Dict, Any

EARTH_RADIUS_KM = 6371.0088

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two geographic coordinates in kilometers."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_KM * c

def calculate_polygon_area_km2(coordinates: List[List[float]]) -> float:
    """
    Computes geodesic surface area of a polygon on the WGS-84 sphere in square kilometers.
    Coordinates are expected as [[lon1, lat1], [lon2, lat2], ..., [lon1, lat1]].
    """
    if len(coordinates) < 3:
        return 0.0

    # Spherical excess / polygon area via spherical trapezoid summation
    total_area_rad = 0.0
    num_pts = len(coordinates)

    for i in range(num_pts):
        p1 = coordinates[i]
        p2 = coordinates[(i + 1) % num_pts]

        lon1, lat1 = math.radians(p1[0]), math.radians(p1[1])
        lon2, lat2 = math.radians(p2[0]), math.radians(p2[1])

        total_area_rad += (lon2 - lon1) * (2.0 + math.sin(lat1) + math.sin(lat2))

    area_km2 = abs(total_area_rad * (EARTH_RADIUS_KM ** 2) / 2.0)
    return round(area_km2, 4)

def calculate_bbox_and_center(coordinates: List[List[float]]) -> Tuple[List[float], Dict[str, float]]:
    """
    Calculates [min_lon, min_lat, max_lon, max_lat] and center {lat, lon}.
    """
    if not coordinates:
        return [0.0, 0.0, 0.0, 0.0], {"lat": 0.0, "lon": 0.0}

    lons = [p[0] for p in coordinates]
    lats = [p[1] for p in coordinates]

    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)

    center_lat = (min_lat + max_lat) / 2.0
    center_lon = (min_lon + max_lon) / 2.0

    return [round(min_lon, 6), round(min_lat, 6), round(max_lon, 6), round(max_lat, 6)], {
        "lat": round(center_lat, 6),
        "lon": round(center_lon, 6)
    }
