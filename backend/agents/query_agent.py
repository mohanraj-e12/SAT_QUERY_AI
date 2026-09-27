"""
SatQueryAI - Query Understanding Agent
Extracts user intent, classifies remote-sensing task, selects optimal AI algorithms and preprocessing.
"""

from typing import Dict, Any, List
import re


class QueryUnderstandingAgent:
    """
    Intelligent agent analyzing natural-language prompts about Earth observation imagery.
    Determines:
    - User intent
    - Requested analysis
    - Required algorithm (CLIP, ViT, U-Net, SAM, RSVQA, XGBoost)
    - Required preprocessing (Optical vs SAR, contrast, normalization)
    - Expected output (mask, bounding box, percentage, classification, answer)
    """

    def analyze_query(self, query: str) -> Dict[str, Any]:
        q = query.lower().strip()

        # 1. Intent Extraction & Task Classification
        if any(w in q for w in ["detect building", "find building", "buildings", "houses", "structures", "roof"]):
            intent = "OBJECT_DETECTION_BUILDINGS"
            task = "buildings"
            algorithm = "SAM / U-Net"
            analysis_type = "OBJECT_DETECTION"
            expected_output = "segmentation_mask_and_bounding_boxes"
            preprocessing = "optical_contrast_enhancement"
            target = "buildings"

        elif any(w in q for w in ["water", "river", "lake", "ocean", "reservoir", "pond", "flood", "inundat"]):
            is_flood = "flood" in q or "inundat" in q
            intent = "FLOOD_DETECTION" if is_flood else "WATER_BODY_SEGMENTATION"
            task = "flood" if is_flood else "water"
            algorithm = "U-Net (Semantic Segmentation)"
            analysis_type = "WATER_DETECTION"
            expected_output = "segmentation_mask_and_coverage_percentage"
            preprocessing = "optical_or_sar_intensity_normalization"
            target = "flood" if is_flood else "water"

        elif any(w in q for w in ["vegetation", "forest", "tree", "green", "agriculture", "crop", "farm", "plant"]):
            intent = "VEGETATION_AND_CANOPY_ANALYSIS"
            task = "vegetation"
            algorithm = "U-Net + NDVI Spectral Engine"
            analysis_type = "VEGETATION"
            expected_output = "vegetation_mask_and_ndvi_distribution"
            preprocessing = "optical_channel_normalization"
            target = "vegetation"

        elif any(w in q for w in ["urban", "rural", "city", "sprawl", "expansion", "built-up", "built up", "growth"]):
            intent = "URBAN_EXTENT_ANALYSIS"
            task = "urban"
            algorithm = "ViT + U-Net + NDBI"
            analysis_type = "BUILT_UP_ANALYSIS"
            expected_output = "urban_mask_and_growth_statistics"
            preprocessing = "optical_edge_preserving_clahe"
            target = "urban"

        elif any(w in q for w in ["road", "highway", "street", "infrastructure", "runway"]):
            intent = "LINEAR_FEATURE_DETECTION"
            task = "roads"
            algorithm = "SAM (Segment Anything) + U-Net"
            analysis_type = "OBJECT_DETECTION"
            expected_output = "road_network_delineation"
            preprocessing = "optical_contrast_enhancement"
            target = "roads"

        elif any(w in q for w in ["land cover", "classes", "clc", "partition", "what is this", "classify"]):
            intent = "LAND_COVER_CLASSIFICATION"
            task = "land_cover"
            algorithm = "Vision Transformer (ViT) + CLIP"
            analysis_type = "LAND_COVER"
            expected_output = "multi_class_distribution_and_labels"
            preprocessing = "optical_normalization_and_rgb_preview"
            target = "land_cover"

        elif any(w in q for w in ["how many", "count", "number"]):
            intent = "FEATURE_COUNTING"
            task = "buildings" if "building" in q else "objects"
            algorithm = "SAM + RSVQA"
            analysis_type = "OBJECT_DETECTION"
            expected_output = "discrete_count_and_bounding_boxes"
            preprocessing = "optical_gradient_enhancement"
            target = "objects"

        else:
            intent = "MULTIMODAL_IMAGE_UNDERSTANDING"
            task = "general_understanding"
            algorithm = "CLIP + RSVQA"
            analysis_type = "GENERAL_QUERY"
            expected_output = "evidence_grounded_answer"
            preprocessing = "optical_channel_normalization"
            target = "scene"

        return {
            "query": query,
            "intent": intent,
            "task": task,
            "target": target,
            "algorithm": algorithm,
            "analysis_type": analysis_type,
            "preprocessing": preprocessing,
            "expected_output": expected_output,
            "is_percentage_requested": any(w in q for w in ["percentage", "ratio", "how much", "fraction"]),
            "is_counting_requested": any(w in q for w in ["how many", "count", "number of"]),
        }


query_agent = QueryUnderstandingAgent()
