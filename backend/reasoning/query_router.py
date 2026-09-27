"""
SatQueryAI - Question Router & Task Classification
Maps user natural-language questions to specialized remote-sensing tasks and execution strategies.
"""

from typing import Dict, Any, List

TASK_DEFINITIONS = {
    "LAND_COVER_CLASSIFICATION": {
        "keywords": ["land cover", "type of land", "classification", "classes", "corine", "clc", "category", "terrain", "landscape"],
        "task_name": "land_cover",
        "description": "Multi-class land surface partitioning and dominant land-cover determination.",
        "specialist_focus": "Corine Land Cover 19-class taxonomy, biophysical surface types, and area coverage percentages."
    },
    "WATER_DETECTION": {
        "keywords": ["water", "river", "lake", "ocean", "sea", "flood", "wetland", "reservoir", "coast", "shoreline", "pond"],
        "task_name": "water_detection",
        "description": "Detection, delineation, and percentage estimation of water bodies and aquatic surfaces.",
        "specialist_focus": "NDWI spectral absorption, surface water boundaries, moisture content, and aquatic boundaries."
    },
    "URBAN_FEATURE_ANALYSIS": {
        "keywords": ["urban", "building", "buildings", "city", "structure", "structures", "roof", "settlement", "built-up", "industrial", "commercial", "houses"],
        "task_name": "urban_feature_analysis",
        "description": "Urban infrastructure, built-up footprints, and structural density analysis.",
        "specialist_focus": "High spatial frequency edge density, rectangular footprints, concrete/asphalt spectral reflectance."
    },
    "VEGETATION_ANALYSIS": {
        "keywords": ["vegetation", "forest", "tree", "trees", "crop", "canopy", "grass", "green", "greenery", "pasture", "woodland"],
        "task_name": "vegetation_analysis",
        "description": "Vegetation density, forest canopy health, and biomass distribution.",
        "specialist_focus": "Excess Green index, chlorophyll absorption, canopy texture homogeneity, and foliage density."
    },
    "AGRICULTURE": {
        "keywords": ["agriculture", "agricultural", "farm", "farms", "field", "fields", "cultivation", "plantation", "irrigation", "soil", "harvest", "crop field"],
        "task_name": "agriculture",
        "description": "Agricultural crop identification, field boundaries, and tillage patterns.",
        "specialist_focus": "Geometric parcel boundaries, crop growth stages, ploughed soil signatures, and irrigation circles."
    },
    "ROAD_FEATURE_ANALYSIS": {
        "keywords": ["road", "roads", "highway", "street", "corridor", "transportation", "runway", "railway", "track"],
        "task_name": "road_feature_analysis",
        "description": "Linear transportation network extraction and connectivity mapping.",
        "specialist_focus": "Continuous linear gradient features, asphalt/gravel corridors, and transport infrastructure."
    },
    "IMAGE_COMPARISON": {
        "keywords": ["compare", "difference", "change", "bi-temporal", "before and after", "evolution", "loss", "growth"],
        "task_name": "image_comparison",
        "description": "Bi-temporal change detection and spectral divergence analysis.",
        "specialist_focus": "Multi-epoch pixel difference, radiometric normalization, and land use transition tracking."
    },
    "SEMANTIC_SEGMENTATION": {
        "keywords": ["segment", "segmentation", "mask", "delineate", "outline", "highlight regions", "boundary map"],
        "task_name": "segmentation",
        "description": "Pixel-level dense classification and categorical mask generation.",
        "specialist_focus": "Dense pixel assignment, boundary spatial precision, and area estimation."
    },
    "SCENE_DESCRIPTION": {
        "keywords": ["what is visible", "describe", "explain", "overview", "summary", "analyze this", "tell me about"],
        "task_name": "scene_description",
        "description": "Comprehensive multimodal environmental scene description.",
        "specialist_focus": "Holistic visual understanding, geographic context, and multi-feature synthesis."
    }
}

class QueryRouter:
    """
    Analyzes input query and routes to the most appropriate remote-sensing task.
    """

    def route_query(self, query: str) -> Dict[str, Any]:
        q_lower = query.lower().strip()

        best_task_key = "SCENE_DESCRIPTION"
        best_score = 0

        for task_key, task_info in TASK_DEFINITIONS.items():
            score = 0
            for kw in task_info["keywords"]:
                if kw in q_lower:
                    # Prefer longer keyword matches
                    score += len(kw.split()) + 1
            if score > best_score:
                best_score = score
                best_task_key = task_key

        routed_info = TASK_DEFINITIONS[best_task_key]
        return {
            "task_key": best_task_key,
            "task_name": routed_info["task_name"],
            "description": routed_info["description"],
            "specialist_focus": routed_info["specialist_focus"],
            "match_confidence": min(1.0, max(0.5, 0.4 + best_score * 0.15)),
        }

query_router = QueryRouter()
