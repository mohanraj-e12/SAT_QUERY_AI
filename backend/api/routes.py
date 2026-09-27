"""
SatQueryAI - API Routes Module
Exposes endpoints for image upload, multimodal analysis (/api/analyze, /api/query),
segmentation, classification, and benchmark reporting.
"""

from typing import Dict, Any, Optional
import time
from backend.reasoning.answer_generator import answer_generator
from backend.storage.image_storage import image_storage
from backend.models.segmentation import segmentation_adapter
from backend.models.classifier import remote_sensing_classifier
from backend.utils.image_utils import validate_and_load_image

def handle_analyze_request(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handles POST /api/analyze and POST /api/query.
    Accepts:
    - image: base64 Data URL, file path, or image_id
    - question: natural-language query
    """
    question = payload.get("question") or payload.get("query") or ""
    image_source = (
        payload.get("image")
        or payload.get("image_data")
        or payload.get("imageBase64")
        or payload.get("fileData")
        or payload.get("image_id")
        or payload.get("imageId")
    )

    if not question.strip():
        return {
            "error": "Question / query parameter is required.",
            "status": "error"
        }

    # If image_id is passed, retrieve from storage
    if isinstance(image_source, str) and not image_source.startswith("data:") and not image_source.startswith("http"):
        stored = image_storage.get_image(image_source)
        if stored:
            image_source = stored.get("data_url") or stored.get("file_path") or image_source

    if not image_source:
        # Default placeholder satellite image for testing if not provided
        image_source = "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1200&q=80"

    query_id = payload.get("query_id") or f"q_{int(time.time() * 1000)}"
    result = answer_generator.generate_analysis(
        image_source=image_source,
        question=question,
        query_id=query_id
    )

    return result

def handle_upload_request(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handles POST /api/upload.
    """
    file_data = payload.get("fileData") or payload.get("image")
    file_name = payload.get("fileName") or "satellite_scene.png"

    if not file_data:
        return {"error": "fileData is required for upload", "status": "error"}

    img, meta, err = validate_and_load_image(file_data)
    if err or not img:
        return {"error": f"Upload failed: {err}", "status": "error"}

    stored_item = image_storage.save_image(
        image_bytes_or_pil=img,
        filename=file_name,
        metadata=meta
    )

    return {
        "image_id": stored_item["id"],
        "filename": stored_item["filename"],
        "width": stored_item["metadata"].get("width", 1024),
        "height": stored_item["metadata"].get("height", 1024),
        "bands": stored_item["metadata"].get("bands", 3),
        "format": stored_item["metadata"].get("format", "PNG"),
        "status": "uploaded",
        "url": stored_item["url"]
    }
