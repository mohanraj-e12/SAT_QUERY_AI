"""
SatQueryAI - Workflow Management Agent
Orchestrates end-to-end agentic execution:
Query -> Intent -> Task -> Algorithm -> Preprocessing -> Execution -> Post-processing -> Evidence -> Response.
"""

import time
from typing import Dict, Any, Optional

try:
    from backend.agents.query_agent import query_agent
    from backend.preprocessing.optical import optical_preprocessor
    from backend.preprocessing.sar import sar_preprocessor
    from backend.preprocessing.image_utils import load_image_to_pil, pil_to_numpy
    from backend.analysis.segmentation import segment_image
    from backend.analysis.classification import classify_scene
    from backend.analysis.object_detection import detect_objects
    from backend.analysis.statistics import compute_analysis_statistics
    from backend.visualization.overlays import create_blended_overlay
    from backend.models.rsvqa_model import rsvqa_adapter
    from backend.storage.image_storage import image_storage
except ImportError:
    from agents.query_agent import query_agent
    from preprocessing.optical import optical_preprocessor
    from preprocessing.sar import sar_preprocessor
    from preprocessing.image_utils import load_image_to_pil, pil_to_numpy
    from analysis.segmentation import segment_image
    from analysis.classification import classify_scene
    from analysis.object_detection import detect_objects
    from analysis.statistics import compute_analysis_statistics
    from visualization.overlays import create_blended_overlay
    from models.rsvqa_model import rsvqa_adapter
    from storage.image_storage import image_storage


class WorkflowManagementAgent:
    """
    Central agent coordinating input parsing, model selection, execution, and evidence-grounded reporting.
    """

    def process_query_workflow(
        self,
        query: str,
        image_id: Optional[str] = None,
        image_data: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Executes canonical analysis engine producing standardized JSON matching single source of truth architecture.
        """
        from backend.reasoning.canonical_engine import canonical_analysis_engine
        raw_img = image_data
        if image_id and not raw_img:
            stored = image_storage.get_image(image_id)
            if stored:
                raw_img = stored.get("file_path") or stored.get("url")
        
        return canonical_analysis_engine.analyze_scene(
            image_source=raw_img or "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1200&q=80",
            question=query,
            image_id=image_id
        )

    def execute_workflow(
        self,
        query: str,
        image_id: Optional[str] = None,
        image_data: Optional[Any] = None
    ) -> Dict[str, Any]:
        """Alias for process_query_workflow"""
        return self.process_query_workflow(query=query, image_id=image_id, image_data=image_data)


workflow_agent = WorkflowManagementAgent()
