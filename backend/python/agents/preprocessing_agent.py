"""
SatQuery AI - Preprocessing Agent
Coordinates cloud masking, radiometric calibration, atmospheric correction,
CRS verification, and spatial clipping to user-defined AOIs.
"""
from typing import Dict, Any, Optional, List
from processing.preprocessing import preprocessor

class PreprocessingAgent:
    """
    Agent responsible for converting raw satellite granules into Analysis-Ready Data (ARD).
    """
    def prepare_scene(
        self,
        scene_metadata: Dict[str, Any],
        aoi_polygon: Optional[List[List[float]]] = None,
        apply_cloud_mask: bool = True
    ) -> Dict[str, Any]:
        """
        Runs ARD standardization on satellite scenes.
        """
        report = preprocessor.perform_preprocessing(
            image_metadata=scene_metadata,
            aoi_polygon=aoi_polygon,
            apply_cloud_mask=apply_cloud_mask,
            atmospheric_correction=True
        )

        return {
            "agent": "PreprocessingAgent",
            "scene_id": scene_metadata.get("scene_id") or scene_metadata.get("id"),
            "satellite": scene_metadata.get("satellite"),
            "preprocessing_report": report
        }

preprocessing_agent = PreprocessingAgent()
