"""
SatQueryAI - Main FastAPI Application & Server Entry Point
Interactive Vision-Language Assistant for Multimodal Remote Sensing Image Analysis
"""

import os
import sys
import json
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))
if str(BASE_DIR.parent) not in sys.path:
    sys.path.insert(0, str(BASE_DIR.parent))

from config import APP_NAME, APP_VERSION, APP_DESCRIPTION, HOST, PORT, CORS_ORIGINS, UPLOAD_DIR, OUTPUT_DIR
from api.upload import handle_upload_bytes, handle_upload_base64
from api.query import handle_query_request
from api.analysis import handle_segment_request, handle_classify_request, handle_detect_request
from storage.image_storage import image_storage

# Detect if FastAPI and Uvicorn are available
try:
    from fastapi import FastAPI, UploadFile, File, Form, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import JSONResponse
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False


def create_fastapi_app():
    """Initializes standard FastAPI application."""
    app = FastAPI(
        title=APP_NAME,
        version=APP_VERSION,
        description=APP_DESCRIPTION,
    )

    # Enable CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Static assets serving for uploaded scenes and outputs
    app.mount("/api/storage/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
    app.mount("/api/storage/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")

    # FEATURE 9: Health Check Endpoint
    @app.get("/api/health")
    async def health_check():
        return {
            "status": "online",
            "backend": "SatQueryAI",
            "version": "1.0",
        }

    # FEATURE 1: Image Upload Endpoint
    @app.post("/api/upload")
    async def upload_image_endpoint(file: UploadFile = File(...)):
        try:
            content = await file.read()
            return handle_upload_bytes(content, file.filename or "uploaded_scene.png")
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    # FEATURE 2: Natural Language Query Endpoint
    @app.post("/api/query")
    async def query_endpoint(payload: dict):
        try:
            return handle_query_request(payload)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

    # FEATURE 5: Segmentation Endpoint
    @app.post("/api/segment")
    async def segment_endpoint(payload: dict):
        try:
            return handle_segment_request(payload)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # Auxiliary Analysis Endpoints
    @app.post("/api/classify")
    async def classify_endpoint(payload: dict):
        return handle_classify_request(payload)

    @app.post("/api/detect")
    async def detect_endpoint(payload: dict):
        return handle_detect_request(payload)

    @app.get("/api/images")
    async def list_images_endpoint():
        return {"success": True, "images": image_storage.list_images()}

    return app


# Create app instance if FastAPI is available
app = create_fastapi_app() if FASTAPI_AVAILABLE else None


# Standalone Resilient Fallback Server (Pure Python Stdlib HTTP Server)
def run_stdlib_server(host=HOST, port=PORT):
    import http.server
    import socketserver
    from urllib.parse import urlparse

    class SatQueryHTTPHandler(http.server.BaseHTTPRequestHandler):
        def _send_cors(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

        def do_OPTIONS(self):
            self.send_response(204)
            self._send_cors()
            self.end_headers()

        def do_GET(self):
            parsed = urlparse(self.path)
            self._send_cors()

            if parsed.path in ("/api/health", "/health"):
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                res = {"status": "online", "backend": "SatQueryAI", "version": "1.0"}
                self.wfile.write(json.dumps(res).encode("utf-8"))

            elif parsed.path == "/api/images":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                res = {"success": True, "images": image_storage.list_images()}
                self.wfile.write(json.dumps(res).encode("utf-8"))

            else:
                self.send_response(404)
                self.end_headers()

        def do_POST(self):
            parsed = urlparse(self.path)
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)

            self._send_cors()

            try:
                if parsed.path == "/api/upload":
                    # Check if multipart or raw/json
                    ctype = self.headers.get("Content-Type", "")
                    if "application/json" in ctype:
                        payload = json.loads(body_bytes.decode("utf-8"))
                        res = handle_upload_base64(payload)
                    else:
                        # Extract raw file bytes
                        res = handle_upload_bytes(body_bytes, "uploaded_satellite_scene.png")

                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(res).encode("utf-8"))

                elif parsed.path == "/api/query":
                    payload = json.loads(body_bytes.decode("utf-8"))
                    res = handle_query_request(payload)
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(res).encode("utf-8"))

                elif parsed.path == "/api/segment":
                    payload = json.loads(body_bytes.decode("utf-8"))
                    res = handle_segment_request(payload)
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(res).encode("utf-8"))

                elif parsed.path == "/api/classify":
                    payload = json.loads(body_bytes.decode("utf-8"))
                    res = handle_classify_request(payload)
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(res).encode("utf-8"))

                elif parsed.path == "/api/detect":
                    payload = json.loads(body_bytes.decode("utf-8"))
                    res = handle_detect_request(payload)
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(res).encode("utf-8"))

                else:
                    self.send_response(404)
                    self.end_headers()

            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))

    with socketserver.TCPServer((host, port), SatQueryHTTPHandler) as server:
        print(f"🛰️  [SatQueryAI] Python Server listening on http://{host}:{port}")
        server.serve_forever()


if __name__ == "__main__":
    if FASTAPI_AVAILABLE:
        try:
            import uvicorn
            print(f"🛰️  Starting SatQueryAI FastAPI with Uvicorn on http://{HOST}:{PORT}")
            uvicorn.run("backend.main:app", host=HOST, port=PORT, reload=False)
        except Exception:
            run_stdlib_server(HOST, PORT)
    else:
        run_stdlib_server(HOST, PORT)
