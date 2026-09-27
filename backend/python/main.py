"""
SatQuery AI - Standalone Python Main & Microservice Entry Point
SIH26167: Interactive Vision-Language Assistant for Multimodal Remote Sensing Image Analysis
Executes the agentic pipeline, CLI queries, or microservice HTTP server.
"""
import sys
import os
import json
import argparse

# Ensure current directory is in Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agentic_orchestrator import agentic_orchestrator
from agents.query_agent import query_agent
from agents.data_agent import data_agent
from agents.preprocessing_agent import preprocessing_agent
from agents.gis_agent import gis_agent
from agents.vision_agent import vision_agent
from agents.change_agent import change_agent
from agents.explanation_agent import explanation_agent

from processing.ndvi import ndvi_processor
from processing.ndwi import ndwi_processor
from processing.ndbi import ndbi_processor
from processing.change_detection import change_detector

def run_cli_query(query: str, satellite: str = "Sentinel-2", location: str = "Chennai"):
    print(f"\n🛰️  SatQuery AI - Processing Query: '{query}'")
    print(f"📡 Satellite: {satellite} | 📍 Location: {location}\n" + "-" * 60)

    # 1. Retrieve satellite metadata
    scene = data_agent.retrieve_scene_for_query(location, 2025, satellite)
    print(f"[Data Retrieval Agent] Scene: {scene['scene_id']} ({scene['satellite']} {scene['sensor']})")

    # 2. Execute Agentic Pipeline
    result = agentic_orchestrator.process_query(
        query=query,
        primary_image=scene,
        input_mode="AUTO"
    )

    print(f"\n🧠 Task Classified: {result['task']}")
    print(f"🤖 Agents Sequenced: {', '.join(result['agents_executed'])}")
    print(f"⚙️  Models Executed: {', '.join(result['models_executed'])}")
    print(f"⏱️  Latency: {result['total_latency_ms']} ms | Confidence: {result['confidence'] * 100:.1f}%\n")
    print(f"📝 Natural-Language Explanation:\n{result['summary']}\n")

    if result.get("change_metrics"):
        cm = result["change_metrics"]
        print("🔄 Change Metrics:")
        print(f"   • Built-up Area: T1={cm['built_up']['t1_area_km2']} km² -> T2={cm['built_up']['t2_area_km2']} km² (Δ {cm['built_up']['delta_km2']} km², {cm['built_up']['percentage_change']}%)")
        print(f"   • Vegetation:   T1={cm['vegetation']['t1_area_km2']} km² -> T2={cm['vegetation']['t2_area_km2']} km² (Δ {cm['vegetation']['delta_km2']} km², {cm['vegetation']['percentage_change']}%)")

    print(f"\n🗺️  Vector GeoJSON Features: {len(result['geojson_layers']['features'])} demarcated region(s)")
    print(f"💡 Recommendations:")
    for r in result.get("recommendations", []):
        print(f"   • {r}")
    print("-" * 60)

def main():
    parser = argparse.ArgumentParser(description="SatQuery AI - Agentic Remote Sensing Assistant")
    parser.add_argument("--query", "-q", type=str, help="Natural language remote-sensing query")
    parser.add_argument("--location", "-l", type=str, default="Chennai", help="Target geographic entity or city")
    parser.add_argument("--satellite", "-s", type=str, default="Sentinel-2", help="Target satellite platform")
    parser.add_argument("--server", action="store_true", help="Start standalone HTTP REST microservice")

    args = parser.parse_args()

    if args.server:
        from server import run_server
        print("Starting SatQuery AI Python HTTP Microservice...")
        run_server()
    elif args.query:
        run_cli_query(args.query, args.satellite, args.location)
    else:
        # Default showcase demonstration
        run_cli_query("Show urban expansion and vegetation loss between 2021 and 2025 around Chennai", "Sentinel-2", "Chennai")

if __name__ == "__main__":
    main()
