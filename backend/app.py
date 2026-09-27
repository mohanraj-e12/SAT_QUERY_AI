"""
SatQueryAI - FastAPI Application Entry Point
Exposes high-performance REST endpoints for remote-sensing vision-language analysis.
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, Any, Optional

# Ensure workspace root is on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

try:
    from fastapi import FastAPI, UploadFile, File, Form, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False

from backend.api.routes import handle_analyze_request, handle_upload_request
from backend.evaluation.evaluator import benchmark_evaluator

if FASTAPI_AVAILABLE:
    app = FastAPI(
        title="SatQueryAI - Multimodal Remote Sensing Platform",
        description="Vision-Language Assistant for Multimodal Remote Sensing Image Analysis Through Natural-Language Queries",
        version="2.0.0"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class QueryPayload(BaseModel):
        image: Optional[str] = None
        image_data: Optional[str] = None
        imageBase64: Optional[str] = None
        image_id: Optional[str] = None
        question: Optional[str] = None
        query: Optional[str] = None

    @app.get("/api/health")
    def health_check():
        return {
            "status": "online",
            "service": "SatQueryAI Multimodal Remote Sensing AI Platform",
            "version": "2.0.0",
            "vlm_model": os.environ.get("VLM_MODEL", "gemini-3.8-flash"),
            "backend": "FastAPI + BigEarthNet Retrieval",
            "capabilities": ["VLM", "U-Net", "SAM", "BigEarthNet v2.0", "RSVQA"]
        }

    @app.post("/api/analyze")
    def analyze_scene(payload: QueryPayload):
        res = handle_analyze_request(payload.model_dump())
        if "error" in res and res.get("status") == "error":
            raise HTTPException(status_code=400, detail=res["error"])
        return res

    @app.post("/api/query")
    def query_scene(payload: QueryPayload):
        res = handle_analyze_request(payload.model_dump())
        if "error" in res and res.get("status") == "error":
            raise HTTPException(status_code=400, detail=res["error"])
        return res

    @app.post("/api/upload")
    async def upload_image(
        file: Optional[UploadFile] = File(None),
        fileData: Optional[str] = Form(None),
        fileName: Optional[str] = Form(None)
    ):
        if file:
            content = await file.read()
            res = handle_upload_request({"fileData": content, "fileName": file.filename})
        elif fileData:
            res = handle_upload_request({"fileData": fileData, "fileName": fileName or "upload.png"})
        else:
            raise HTTPException(status_code=400, detail="No file or fileData provided")
        return res

    @app.get("/api/evaluation/report")
    def get_evaluation_report():
        return benchmark_evaluator.run_benchmark()

else:
    # Dummy app placeholder if FastAPI is not installed in current environment
    app = None

def main():
    if FASTAPI_AVAILABLE:
        import uvicorn
        uvicorn.run("backend.app:app", host="0.0.0.0", port=8000, reload=False)
    else:
        print("[SatQueryAI] FastAPI not installed. Use Python CLI bridge or install requirements.")

if __name__ == "__main__":
    main()
