"""
SatQuery AI - Agents Package
Houses the modular agentic architecture:
- QueryUnderstandingAgent: Extracts locations, dates, phenomena, indices, and output formats.
- SatelliteDataRetrievalAgent: Manages Sentinel-2, Landsat, ISRO/Bhuvan, and user imagery catalogs.
- PreprocessingAgent: Handles cloud masking, normalization, CRS validation, and spatial clipping.
- GISAgent: Calculates geodesic areas, buffers, intersections, and vector GeoJSON features.
- RemoteSensingVisionAgent: Evaluates foundation models, SegFormer, SAM, and VQA specialists.
- ChangeDetectionAgent: Quantifies bi-temporal transitions and multi-temporal land cover dynamics.
- ExplanationAgent: Formulates domain-grounded natural-language explanations and insights.
"""
from .query_agent import query_agent, QueryUnderstandingAgent
from .data_agent import data_agent, SatelliteDataRetrievalAgent
from .preprocessing_agent import preprocessing_agent, PreprocessingAgent
from .gis_agent import gis_agent, GISAgent
from .vision_agent import vision_agent, RemoteSensingVisionAgent
from .change_agent import change_agent, ChangeDetectionAgent
from .explanation_agent import explanation_agent, ExplanationAgent

__all__ = [
    "query_agent", "QueryUnderstandingAgent",
    "data_agent", "SatelliteDataRetrievalAgent",
    "preprocessing_agent", "PreprocessingAgent",
    "gis_agent", "GISAgent",
    "vision_agent", "RemoteSensingVisionAgent",
    "change_agent", "ChangeDetectionAgent",
    "explanation_agent", "ExplanationAgent",
]
