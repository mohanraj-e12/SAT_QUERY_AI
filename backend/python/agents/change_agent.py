"""
SatQuery AI - Change Detection Agent
Orchestrates multi-temporal analysis between baseline (T1) and monitoring (T2) acquisitions.
Generates transition matrices, quantification metrics, and vectorized change hot-spots.
"""
from typing import Dict, Any, List, Optional
try:
    from processing.change_detection import change_detector
    from models.cdvqa_change import CDVQABiTemporalSpecialist
except ImportError:
    from backend.python.processing.change_detection import change_detector
    from backend.python.models.cdvqa_change import CDVQABiTemporalSpecialist

class ChangeDetectionAgent:
    """
    Agent dedicated to multi-temporal change understanding and quantification.
    """
    def __init__(self):
        self.cdvqa_specialist = CDVQABiTemporalSpecialist()

    def compare_scenes(
        self,
        query: str,
        image_t1: Dict[str, Any],
        image_t2: Dict[str, Any],
        aoi_area_sq_km: float = 120.0
    ) -> Dict[str, Any]:
        """
        Runs bi-temporal change detection and CDVQA reasoning.
        """
        # 1. Quantitative bi-temporal change detection
        spectral_change = change_detector.analyze_temporal_change(
            image_t1=image_t1,
            image_t2=image_t2,
            aoi_area_sq_km=aoi_area_sq_km
        )

        # 2. CDVQA reasoning for conversational explanation
        cdvqa_reasoning = self.cdvqa_specialist.analyze_change(query, image_t1, image_t2)

        return {
            "agent": "ChangeDetectionAgent",
            "time_span": spectral_change["time_period"],
            "quantitative_metrics": spectral_change["metrics"],
            "land_improvement": spectral_change.get("land_improvement"),
            "transitions": spectral_change["transitions"],
            "hotspots": spectral_change["hotspots"],
            "cdvqa_reasoning": cdvqa_reasoning,
            "summary": cdvqa_reasoning.get("change_summary") or cdvqa_reasoning.get("answer"),
            "confidence": 0.942
        }

change_agent = ChangeDetectionAgent()
