"""
SatQueryAI - Answer Generator & Reasoning Orchestrator
Synthesizes task routing, visual feature analysis, VLM inference, segmentation overlays, and evidence extraction.
Enforces the Single Source of Truth architecture via canonical_analysis_engine.
"""

import time
from typing import Dict, Any, Optional
from backend.reasoning.canonical_engine import canonical_analysis_engine
from backend.utils.logging_utils import log_query_debug, logger

class AnswerGenerator:
    """
    Coordinates end-to-end question-answering, VLM reasoning, and evidence extraction via Canonical Engine.
    """

    def generate_analysis(
        self,
        image_source: Any,
        question: str,
        query_id: Optional[str] = None
    ) -> Dict[str, Any]:
        q_id = query_id or f"query_{int(time.time() * 1000)}"

        # Execute canonical analysis engine producing the single source of truth
        canonical_res = canonical_analysis_engine.analyze_scene(
            image_source=image_source,
            question=question,
            image_id=q_id
        )

        # Log query debug record matching FEATURE 16
        log_query_debug(
            query_id=q_id,
            image_hash=canonical_res.get("image_id", "unknown"),
            image_dimensions=(1024, 1024),
            detected_task=canonical_res.get("task", "land_cover_analysis"),
            vlm_model=canonical_res.get("model", "SatQueryAI Multimodal VLM"),
            retrieved_examples=[],
            predictions={"land_cover": canonical_res.get("land_cover")},
            confidence=canonical_res.get("confidence", 0.94),
            processing_time=canonical_res.get("processing_time", 0.1)
        )

        return canonical_res

answer_generator = AnswerGenerator()

