"""
SatQueryAI - Query API Endpoint
Handles POST /api/query for natural-language multimodal remote sensing reasoning.
"""

from typing import Dict, Any, Optional
try:
    from backend.agents.workflow_agent import workflow_agent
    from backend.storage.image_storage import image_storage
except ImportError:
    from agents.workflow_agent import workflow_agent
    from storage.image_storage import image_storage


def handle_query_request(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Core implementation of FEATURE 2 & FEATURE 8:
    POST /api/query
    Input:
    {
      "image_id": "...",
      "query": "Detect buildings in this satellite image"
    }

    Returns:
    {
      "answer": "...",
      "task": "...",
      "algorithm": "...",
      "confidence": 0.0,
      "evidence": [
        "...",
        "..."
      ],
      "visual_result": "...",
      "statistics": {},
      "processing_time": 0.0
    }
    """
    image_id = payload.get("image_id") or payload.get("imageId")
    query = payload.get("query", "").strip()

    if not query:
        raise ValueError("Query string cannot be empty.")

    # Retrieve image data if base64 passed directly
    image_data = payload.get("imageBase64") or payload.get("image_data")

    # Run agentic workflow
    result = workflow_agent.process_query_workflow(
        query=query,
        image_id=image_id,
        image_data=image_data
    )

    return result


# Optional FastAPI Router instantiation
try:
    from fastapi import APIRouter, HTTPException
    from pydantic import BaseModel

    class QueryRequestModel(BaseModel):
        image_id: Optional[str] = None
        query: str
        image_data: Optional[str] = None

    router = APIRouter(prefix="/api", tags=["Query"])

    @router.post("/query")
    async def query_fastapi(req: QueryRequestModel):
        try:
            return handle_query_request(req.dict())
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Query execution failed: {str(e)}")

except ImportError:
    router = None
