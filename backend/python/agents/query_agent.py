"""
SatQuery AI - Query Understanding & Intent Extraction Agent
Interprets natural language remote-sensing queries to extract:
- Geographic location / AOI entity
- Dates & temporal intervals (e.g. 2021 to 2025)
- Requested physical phenomenon (vegetation loss, urban expansion, water bodies, flood, fire)
- Target spectral index (NDVI, NDWI, NDBI, SAVI, NBR, etc.)
- Recommended satellite platform (Sentinel-2, Landsat, Cartosat, RISAT)
- Desired output format (Map, Statistics, Report, GeoJSON)
"""
import re
from typing import Dict, Any, Optional, List

class QueryUnderstandingAgent:
    """
    Translates free-form user text queries into structured remote-sensing task specifications.
    """
    def __init__(self):
        self.known_locations = [
            "chennai", "delhi", "bengaluru", "bangalore", "mumbai", "hyderabad",
            "kolkata", "ahmedabad", "pune", "kochi", "jaipur", "chandigarh",
            "amazon", "sunderbans", "himalayas", "thar"
        ]

    def parse_query(self, query: str) -> Dict[str, Any]:
        """
        Parses user query into structured geospatial parameters.
        """
        q_lower = query.lower()

        # 1. Extract location
        detected_location: Optional[str] = None
        for loc in self.known_locations:
            if loc in q_lower:
                detected_location = loc.capitalize()
                break

        # Check for regex patterns like "around <City>", "in <City>", "over <City>"
        if not detected_location:
            loc_match = re.search(r'\b(?:around|in|over|near|for|of)\s+([A-Z][a-z]+)', query)
            if loc_match:
                detected_location = loc_match.group(1)

        # 2. Extract years / dates
        years = re.findall(r'\b(19\d{2}|20\d{2})\b', query)
        start_year: Optional[int] = None
        end_year: Optional[int] = None
        if len(years) >= 2:
            y1, y2 = int(years[0]), int(years[1])
            start_year = min(y1, y2)
            end_year = max(y1, y2)
        elif len(years) == 1:
            start_year = int(years[0])
            end_year = 2025

        # 3. Detect phenomenon & index
        is_vegetation = any(k in q_lower for k in ["vegetat", "forest", "tree", "green", "canopy", "crop", "agriculture"])
        is_water = any(k in q_lower for k in ["water", "flood", "lake", "river", "reservoir", "inundat", "pond", "coastal"])
        is_urban = any(k in q_lower for k in ["urban", "built-up", "built up", "infrastructure", "building", "expansion", "sprawl", "city", "concrete", "road"])
        is_fire = any(k in q_lower for k in ["burn", "fire", "wildfire", "scar", "disaster"])
        is_change = any(k in q_lower for k in ["change", "loss", "decrease", "increase", "expansion", "growth", "between", "from 20", "compare"])
        is_cross_modal = any(k in q_lower for k in ["sar", "radar", "optical and sar", "penetrate cloud", "cross-modal", "cartosat and risat"])
        is_grounding = any(k in q_lower for k in ["highlight", "where is", "locate", "ground", "box", "demarcate", "find"])
        is_caption = any(k in q_lower for k in ["describe", "caption", "overview", "what is visible"])

        # Determine primary analysis type & spectral index
        analysis_type = "GENERAL_REMOTE_SENSING"
        index = "NONE"
        satellite = "Sentinel-2"

        if is_cross_modal:
            analysis_type = "CROSS_MODAL_PAIR_ANALYSIS"
            satellite = "Cartosat-2S + RISAT-1A SAR"
            index = "OPTICAL_SAR_FUSION"
        elif is_change:
            if is_vegetation:
                analysis_type = "VEGETATION_CHANGE_DETECTION"
                index = "dNDVI"
            elif is_urban:
                analysis_type = "URBAN_EXPANSION_MONITORING"
                index = "dNDBI"
            elif is_water:
                analysis_type = "WATER_DYNAMICS_ANALYSIS"
                index = "dNDWI"
            else:
                analysis_type = "MULTI_TEMPORAL_CHANGE_DETECTION"
                index = "dNDVI_dNDBI"
        elif is_vegetation:
            analysis_type = "VEGETATION_ANALYSIS"
            index = "NDVI"
        elif is_water:
            analysis_type = "WATER_BODY_DETECTION"
            index = "NDWI"
        elif is_urban:
            analysis_type = "URBAN_INFRASTRUCTURE_DETECTION"
            index = "NDBI"
        elif is_fire:
            analysis_type = "BURN_SEVERITY_ANALYSIS"
            index = "NBR"
        elif is_grounding:
            analysis_type = "OBJECT_REGION_GROUNDING"
        elif is_caption:
            analysis_type = "SCENE_CAPTIONING"

        # 4. Desired output format
        output_format = ["INTERACTIVE_MAP", "STATISTICAL_SUMMARY", "NATURAL_LANGUAGE_EXPLANATION"]
        if "report" in q_lower or "pdf" in q_lower or "document" in q_lower:
            output_format.append("AUDITABLE_REPORT")
        if "geojson" in q_lower or "shapefile" in q_lower or "vector" in q_lower:
            output_format.append("GEOJSON_VECTOR")

        return {
            "raw_query": query,
            "extracted_parameters": {
                "location": detected_location or "Selected AOI",
                "start_year": start_year,
                "end_year": end_year,
                "analysis_type": analysis_type,
                "spectral_index": index,
                "target_satellite": satellite,
                "output_formats": output_format,
                "cues": {
                    "is_vegetation": is_vegetation,
                    "is_water": is_water,
                    "is_urban": is_urban,
                    "is_fire": is_fire,
                    "is_change": is_change,
                    "is_cross_modal": is_cross_modal,
                    "is_grounding": is_grounding,
                    "is_caption": is_caption
                }
            }
        }

query_agent = QueryUnderstandingAgent()
