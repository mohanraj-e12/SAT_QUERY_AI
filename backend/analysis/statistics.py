"""
SatQueryAI - Statistics Calculation Module
Computes precision metrics: total pixels, detected pixels, coverage %, object count, confidence, processing time.
"""

from typing import Dict, Any, List, Optional
from ..visualization.charts import generate_coverage_histogram


def compute_analysis_statistics(
    total_pixels: int,
    detected_pixels: int,
    coverage_percentage: float,
    objects_count: int,
    confidence: float,
    processing_time_sec: float,
    task: str = "water"
) -> Dict[str, Any]:
    """
    Assembles standardized statistical report strictly matching FEATURE 7.
    """
    cov_pct = round(float(coverage_percentage), 2)
    tot_px = int(total_pixels)
    det_px = int(detected_pixels)
    obj_cnt = int(objects_count)
    conf = round(float(confidence), 3)
    proc_time = round(float(processing_time_sec), 3)

    histogram = generate_coverage_histogram(cov_pct)

    # Calculate thematic class breakdown for charts
    rem_pct = max(0.0, round(100.0 - cov_pct, 2))
    
    return {
        "total_pixels": tot_px,
        "detected_pixels": det_px,
        "coverage_percentage": cov_pct,
        "number_of_detected_objects": obj_cnt,
        "confidence": conf,
        "processing_time": proc_time,
        "task": task,
        "histogram": histogram,
        "breakdown": [
            {"label": f"Detected {task.capitalize()}", "percentage": cov_pct, "pixels": det_px},
            {"label": "Other Surface Background", "percentage": rem_pct, "pixels": tot_px - det_px},
        ],
    }
