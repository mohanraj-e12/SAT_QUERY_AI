"""
SatQueryAI - Analysis API Endpoints
Provides dedicated endpoints for segmentation, classification, object detection, and statistics.
"""

from typing import Dict, Any, Optional
try:
    from backend.analysis.segmentation import segment_image, SUPPORTED_SEGMENTATION_TASKS
    from backend.analysis.classification import classify_scene
    from backend.analysis.object_detection import detect_objects
    from backend.storage.image_storage import image_storage
except ImportError:
    from analysis.segmentation import segment_image, SUPPORTED_SEGMENTATION_TASKS
    from analysis.classification import classify_scene
    from analysis.object_detection import detect_objects
    from storage.image_storage import image_storage


def handle_segment_request(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Core implementation of FEATURE 5:
    POST /api/segment
    Input:
    {
      "image_id": "...",
      "task": "water"
    }

    Returns:
    {
      "task": "water",
      "mask_url": "...",
      "coverage_percentage": 34.7,
      "confidence": 0.91
    }
    """
    task = payload.get("task", "water")
    image_id = payload.get("image_id") or payload.get("imageId")
    image_data = payload.get("image_data") or payload.get("imageBase64")

    if not image_data and image_id:
        stored = image_storage.get_image(image_id)
        if stored:
            image_data = stored.get("file_path") or stored.get("url")

    if not image_data:
        image_data = "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1200&q=80"

    result = segment_image(image_data, task=task)
    return {
        "task": result["task"],
        "mask_url": result["mask_url"],
        "coverage_percentage": result["coverage_percentage"],
        "confidence": result["confidence"],
    }


def handle_classify_request(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handles POST /api/classify."""
    image_id = payload.get("image_id") or payload.get("imageId")
    image_data = payload.get("image_data") or payload.get("imageBase64")
    if not image_data and image_id:
        stored = image_storage.get_image(image_id)
        if stored:
            image_data = stored.get("file_path") or stored.get("url")

    if not image_data:
        image_data = "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1200&q=80"

    return classify_scene(image_data)


def handle_detect_request(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handles POST /api/detect."""
    target = payload.get("target", "buildings")
    image_id = payload.get("image_id") or payload.get("imageId")
    image_data = payload.get("image_data") or payload.get("imageBase64")
    if not image_data and image_id:
        stored = image_storage.get_image(image_id)
        if stored:
            image_data = stored.get("file_path") or stored.get("url")

    if not image_data:
        image_data = "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1200&q=80"

    return detect_objects(image_data, prompt_target=target)


# Optional FastAPI Router instantiation
try:
    from fastapi import APIRouter, HTTPException
    from pydantic import BaseModel

    class SegmentRequestModel(BaseModel):
        image_id: Optional[str] = None
        task: str = "water"
        image_data: Optional[str] = None

    class ClassifyRequestModel(BaseModel):
        image_id: Optional[str] = None
        image_data: Optional[str] = None

    class DetectRequestModel(BaseModel):
        image_id: Optional[str] = None
        target: str = "buildings"
        image_data: Optional[str] = None

    router = APIRouter(prefix="/api", tags=["Analysis"])

    @router.post("/segment")
    async def segment_fastapi(req: SegmentRequestModel):
        try:
            return handle_segment_request(req.dict())
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/classify")
    async def classify_fastapi(req: ClassifyRequestModel):
        try:
            return handle_classify_request(req.dict())
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/detect")
    async def detect_fastapi(req: DetectRequestModel):
        try:
            return handle_detect_request(req.dict())
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

except ImportError:
    router = None
