"""
SatQueryAI - Logging Utilities
Provides structured debug logging for remote-sensing workflows.
Never logs sensitive keys or tokens.
"""

import os
import sys
import json
import time
import logging
from typing import Dict, Any, Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger("SatQueryAI")

def log_query_debug(
    query_id: str,
    image_hash: str,
    image_dimensions: tuple,
    detected_task: str,
    vlm_model: str,
    retrieved_examples: list,
    predictions: Dict[str, Any],
    confidence: float,
    processing_time: float
) -> None:
    """
    Structured query debug log matching FEATURE 16.
    """
    debug_record = {
        "event": "REMOTE_SENSING_QUERY_DEBUG",
        "query_id": query_id,
        "image_hash": image_hash,
        "image_dimensions": f"{image_dimensions[0]}x{image_dimensions[1]}",
        "detected_task": detected_task,
        "vlm_model": vlm_model,
        "retrieved_count": len(retrieved_examples),
        "top_retrieval": retrieved_examples[0].get("patch_id") if retrieved_examples else None,
        "predictions": predictions,
        "confidence": round(confidence, 3),
        "processing_time_sec": round(processing_time, 4),
        "timestamp": time.time()
    }
    logger.info(f"[DEBUG_QUERY] {json.dumps(debug_record)}")
