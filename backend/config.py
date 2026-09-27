"""
SatQueryAI - Configuration Module
Manages platform settings, model paths, storage directories, and environment variables.
"""

import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
STORAGE_DIR = BASE_DIR / "storage"
UPLOAD_DIR = STORAGE_DIR / "uploads"
OUTPUT_DIR = STORAGE_DIR / "outputs"
CACHE_DIR = STORAGE_DIR / "cache"

# Ensure directories exist
for directory in [STORAGE_DIR, UPLOAD_DIR, OUTPUT_DIR, CACHE_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# Application Information
APP_NAME = "SatQueryAI"
APP_VERSION = "1.0"
APP_DESCRIPTION = "Interactive Vision-Language Assistant for Multimodal Remote Sensing Image Analysis"

# Server Configuration
HOST = os.getenv("SATQUERY_HOST", "0.0.0.0")
PORT = int(os.getenv("SATQUERY_PORT", 8000))
DEBUG = os.getenv("SATQUERY_DEBUG", "false").lower() in ("true", "1", "yes")

# CORS Settings
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "*",
]

# Security & Upload Validation
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}
ALLOWED_MIMETYPES = {
    "image/png",
    "image/jpeg",
    "image/tiff",
    "image/x-tiff",
    "application/octet-stream",
}
MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

# AI Model Configuration
DEFAULT_DEVICE = os.getenv("SATQUERY_DEVICE", "cpu")  # "cuda" or "cpu"
CLIP_MODEL_NAME = os.getenv("CLIP_MODEL_NAME", "openai/clip-vit-base-patch32")
VIT_MODEL_NAME = os.getenv("VIT_MODEL_NAME", "google/vit-base-patch16-224")
SAM_CHECKPOINT = os.getenv("SAM_CHECKPOINT", str(STORAGE_DIR / "models" / "sam_vit_h.pth"))
UNET_CHECKPOINT = os.getenv("UNET_CHECKPOINT", str(STORAGE_DIR / "models" / "unet_water_land.pth"))
RSVQA_MODEL_NAME = os.getenv("RSVQA_MODEL_NAME", "rsvqa-multimodal-v1")

# Remote Sensing Spectral Thresholds
SPECTRAL_THRESHOLDS = {
    "water_ndwi_min": 0.05,
    "vegetation_ndvi_min": 0.20,
    "dense_vegetation_ndvi_min": 0.45,
    "urban_ndbi_min": 0.05,
    "flood_threshold": 0.15,
}

# Corine Land Cover (CLC-19) Standard Classes
CLC_CLASSES = [
    "Continuous Urban Fabric",
    "Discontinuous Urban Fabric",
    "Industrial or Commercial Units",
    "Road and Rail Networks",
    "Port Areas",
    "Airports",
    "Mineral Extraction Sites",
    "Dump Sites",
    "Construction Sites",
    "Green Urban Areas",
    "Sport and Leisure Facilities",
    "Non-irrigated Arable Land",
    "Permanently Irrigated Land",
    "Rice Fields",
    "Vineyards",
    "Fruit Trees and Berry Plantations",
    "Olive Groves",
    "Pastures",
    "Complex Cultivation Patterns",
]
