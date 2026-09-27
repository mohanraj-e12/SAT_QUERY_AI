"""
SatQueryAI - Image Storage Module
Manages file persistence, image metadata tracking, and path sanitization.
"""

import os
import uuid
import time
import shutil
import base64
from pathlib import Path
from typing import Dict, Any, Optional, List

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    from config import UPLOAD_DIR, OUTPUT_DIR, ALLOWED_EXTENSIONS, MAX_UPLOAD_SIZE_BYTES
except ImportError:
    from backend.config import UPLOAD_DIR, OUTPUT_DIR, ALLOWED_EXTENSIONS, MAX_UPLOAD_SIZE_BYTES


class ImageStorageManager:
    """Manages uploaded images, generated overlays, and session assets."""

    def __init__(self):
        self.upload_dir = Path(UPLOAD_DIR)
        self.output_dir = Path(OUTPUT_DIR)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        # In-memory index of images: image_id -> metadata dict
        self._index: Dict[str, Dict[str, Any]] = {}
        self._seed_default_scenes()

    def _seed_default_scenes(self):
        """Seed default demonstration scenes so immediate querying works even before upload."""
        demo_scenes = [
            {
                "image_id": "scene-sentinel2-chennai",
                "filename": "Sentinel2_Chennai_Coastal_2025.jpg",
                "width": 1024,
                "height": 1024,
                "bands": 3,
                "format": "JPEG",
                "status": "uploaded",
                "file_path": None,
                "satellite": "Sentinel-2 L2A",
                "modality": "OPTICAL",
                "url": "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1200&q=80",
                "created_at": time.time(),
            },
            {
                "image_id": "scene-delhi-urban",
                "filename": "Landsat9_Delhi_Urban_2025.jpg",
                "width": 1024,
                "height": 1024,
                "bands": 3,
                "format": "JPEG",
                "status": "uploaded",
                "file_path": None,
                "satellite": "Landsat-9 OLI-2",
                "modality": "OPTICAL",
                "url": "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1200&q=80",
                "created_at": time.time(),
            },
            {
                "image_id": "scene-sar-mumbai",
                "filename": "Sentinel1_Mumbai_SAR_VV_VH.png",
                "width": 1024,
                "height": 1024,
                "bands": 2,
                "format": "PNG",
                "status": "uploaded",
                "file_path": None,
                "satellite": "Sentinel-1 SAR C-Band",
                "modality": "SAR",
                "url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
                "created_at": time.time(),
            },
        ]
        for s in demo_scenes:
            self._index[s["image_id"]] = s

    def sanitize_filename(self, filename: str) -> str:
        """Sanitizes user filename to prevent path traversal."""
        clean = Path(filename).name
        # Remove dangerous characters
        clean = "".join(c for c in clean if c.isalnum() or c in "._- ")
        return clean or f"image_{int(time.time())}.png"

    def save_bytes(self, data: bytes, original_filename: str) -> Dict[str, Any]:
        """Saves raw bytes to disk and indexes metadata."""
        if len(data) > MAX_UPLOAD_SIZE_BYTES:
            raise ValueError(f"File size exceeds maximum allowed limit of {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB")

        clean_name = self.sanitize_filename(original_filename)
        ext = Path(clean_name).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(f"Unsupported format '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

        image_id = f"img_{uuid.uuid4().hex[:12]}"
        saved_filename = f"{image_id}_{clean_name}"
        destination = self.upload_dir / saved_filename

        with open(destination, "wb") as f:
            f.write(data)

        # Inspect dimensions and bands
        width, height, bands, img_format = self._inspect_image(destination, ext)

        meta = {
            "image_id": image_id,
            "filename": clean_name,
            "saved_filename": saved_filename,
            "file_path": str(destination),
            "width": width,
            "height": height,
            "bands": bands,
            "format": img_format,
            "status": "uploaded",
            "size_bytes": len(data),
            "url": f"/api/storage/uploads/{saved_filename}",
            "created_at": time.time(),
        }

        self._index[image_id] = meta
        return meta

    def save_base64(self, b64_str: str, original_filename: str = "upload.jpg") -> Dict[str, Any]:
        """Decodes and stores base64 data."""
        if "," in b64_str:
            b64_str = b64_str.split(",", 1)[1]
        raw_bytes = base64.b64decode(b64_str)
        return self.save_bytes(raw_bytes, original_filename)

    def _inspect_image(self, file_path: Path, ext: str):
        """Reads width, height, bands, and format."""
        if PIL_AVAILABLE:
            try:
                with Image.open(file_path) as im:
                    width, height = im.size
                    mode = im.mode
                    bands = len(mode) if mode not in ("1", "L", "P") else 1
                    img_format = im.format or ext.replace(".", "").upper()
                    return width, height, bands, img_format
            except Exception:
                pass

        # Rasterio fallback for GeoTIFF if available
        try:
            import rasterio
            with rasterio.open(file_path) as src:
                return src.width, src.height, src.count, "GeoTIFF"
        except Exception:
            pass

        # Default fallback
        fmt = "GeoTIFF" if ext in (".tif", ".tiff") else ext.replace(".", "").upper()
        return 1024, 1024, 3, fmt

    def get_image(self, image_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves image metadata by ID."""
        return self._index.get(image_id)

    def get_image_bytes(self, image_id: str) -> Optional[bytes]:
        """Returns raw bytes of the stored image if available on disk."""
        meta = self.get_image(image_id)
        if not meta:
            return None
        file_path = meta.get("file_path")
        if file_path and os.path.exists(file_path):
            with open(file_path, "rb") as f:
                return f.read()
        return None

    def list_images(self) -> List[Dict[str, Any]]:
        """Returns all indexed images."""
        return list(self._index.values())

    def save_output_artifact(self, filename: str, data: bytes) -> str:
        """Saves generated mask/overlay and returns public URL."""
        dest = self.output_dir / filename
        with open(dest, "wb") as f:
            f.write(data)
        return f"/api/storage/outputs/{filename}"


# Singleton instance
image_storage = ImageStorageManager()
