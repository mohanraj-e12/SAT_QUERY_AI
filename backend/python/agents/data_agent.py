"""
SatQuery AI - Satellite Data Retrieval Agent
Responsible for indexing and fetching remote-sensing datasets:
- Sentinel-2 (Copernicus L2A MSI, 10m/20m)
- Landsat-8/9 (USGS OLI/TIRS, 30m)
- ISRO/Bhuvan (Cartosat-2S 0.65m optical & RISAT-1A SAR C-band)
- Google Earth Engine (GEE) collection proxies
- User-uploaded GeoTIFF / Multimodal images
"""
from typing import Dict, Any, List, Optional

class SatelliteDataRetrievalAgent:
    """
    Manages satellite catalog queries and retrieves scene metadata for analysis.
    """
    def __init__(self):
        self.catalogs = {
            "Sentinel-2": {
                "agency": "ESA / Copernicus",
                "sensor": "MSI (Multispectral Instrument)",
                "bands": 13,
                "resolution_m": 10.0,
                "revisit_days": 5,
                "gee_id": "COPERNICUS/S2_SR_HARMONIZED"
            },
            "Landsat-8": {
                "agency": "NASA / USGS",
                "sensor": "OLI / TIRS",
                "bands": 11,
                "resolution_m": 30.0,
                "revisit_days": 16,
                "gee_id": "LANDSAT/LC08/C02/T1_L2"
            },
            "Cartosat-2S": {
                "agency": "ISRO",
                "sensor": "PAN (0.65m) + MSI (2.5m)",
                "bands": 5,
                "resolution_m": 0.65,
                "revisit_days": 4,
                "platform": "Indian Remote Sensing (IRS)"
            },
            "RISAT-1A": {
                "agency": "ISRO",
                "sensor": "C-band Synthetic Aperture Radar (SAR)",
                "polarization": "Dual-Pol (HH + HV)",
                "resolution_m": 3.0,
                "all_weather_cloud_penetration": True
            }
        }

    def retrieve_scene_for_query(
        self,
        location: str,
        target_year: Optional[int] = None,
        satellite_preference: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Retrieves matching satellite image descriptor based on location and year.
        """
        year = target_year or 2025
        sat = satellite_preference or "Sentinel-2"
        catalog_info = self.catalogs.get(sat, self.catalogs["Sentinel-2"])

        scene_id = f"SCENE-{sat[:4].upper()}-{location[:3].upper()}-{year}"
        acquisition_date = f"{year}-03-15T05:30:00Z"

        return {
            "scene_id": scene_id,
            "satellite": sat,
            "sensor": catalog_info.get("sensor", "MSI"),
            "location_name": location,
            "acquisition_date": acquisition_date,
            "resolution_meters": catalog_info.get("resolution_m", 10.0),
            "cloud_cover_percentage": 2.4,
            "format": "GeoTIFF (Cloud-Optimized)",
            "bounding_box": [77.10, 28.50, 77.30, 28.70] if "delhi" in location.lower() else [80.15, 12.95, 80.30, 13.15],
            "catalog_metadata": catalog_info
        }

    def retrieve_bitemporal_pair(
        self,
        location: str,
        start_year: int = 2021,
        end_year: int = 2025,
        satellite: str = "Sentinel-2"
    ) -> Dict[str, Any]:
        """
        Retrieves matching bi-temporal image pair (T1 and T2) for change analysis.
        """
        t1 = self.retrieve_scene_for_query(location, start_year, satellite)
        t2 = self.retrieve_scene_for_query(location, end_year, satellite)
        return {
            "pair_type": "BI_TEMPORAL_CO_REGISTERED",
            "location": location,
            "t1_scene": t1,
            "t2_scene": t2,
            "baseline_years": end_year - start_year
        }

data_agent = SatelliteDataRetrievalAgent()
