"""
SatQueryAI - Upload API Endpoint
Handles POST /api/upload for PNG, JPG/JPEG, TIFF, GeoTIFF.
"""

from typing import Dict, Any
import base64
from pathlib import Path

try:
    from backend.storage.image_storage import image_storage
    from backend.config import ALLOWED_EXTENSIONS, MAX_UPLOAD_SIZE_BYTES
except ImportError:
    from storage.image_storage import image_storage
    from config import ALLOWED_EXTENSIONS, MAX_UPLOAD_SIZE_BYTES


def handle_upload_bytes(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Core implementation of FEATURE 1:
    POST /api/upload
    Accepts: PNG, JPG/JPEG, TIFF, GeoTIFF
    Returns:
    {
      "image_id": "...",
      "filename": "...",
      "width": 0,
      "height": 0,
      "bands": 0,
      "format": "...",
      "status": "uploaded"
    }
    """
    if not file_bytes:
        raise ValueError("No file content received.")

    if len(file_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise ValueError(f"Uploaded file exceeds limit of {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB.")

    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported format '{ext}'. Allowed formats: {', '.join(ALLOWED_EXTENSIONS)}")

    meta = image_storage.save_bytes(file_bytes, filename)

    return {
        "image_id": meta["image_id"],
        "filename": meta["filename"],
        "width": meta["width"],
        "height": meta["height"],
        "bands": meta["bands"],
        "format": meta["format"],
        "status": "uploaded",
        "url": meta.get("url"),
    }


def handle_upload_base64(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Handles base64 JSON payload uploads."""
    b64 = payload.get("fileData") or payload.get("base64") or payload.get("data")
    filename = payload.get("fileName") or payload.get("filename") or "uploaded_scene.png"
    if not b64:
        raise ValueError("Missing file data in payload.")
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    raw_bytes = base64.b64decode(b64)
    return handle_upload_bytes(raw_bytes, filename)


# Optional FastAPI Router instantiation
try:
    from fastapi import APIRouter, UploadFile, File, Form, HTTPException
    router = APIRouter(prefix="/api", tags=["Upload"])

    @router.post("/upload")
    async def upload_file_fastapi(file: UploadFile = File(...)):
        try:
            content = await file.read()
            return handle_upload_bytes(content, file.filename or "upload.png")
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

except ImportError:
    router = None
