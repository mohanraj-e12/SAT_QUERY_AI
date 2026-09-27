"""
SatQuery AI - Prediction Export Module
Exports model and agentic predictions to standard exchange formats:
- JSON (Benchmark submission format)
- GeoJSON (Spatial detection boundaries & coverage footprints)
- CSV (Tabular summary of accuracy, IoU, and confidence metrics)
"""
import json
from typing import Dict, Any, List

def export_prediction_to_json(predictions: Dict[str, Any], output_path: str = None) -> str:
    """Exports prediction dictionary to JSON string or writes to disk."""
    formatted = json.dumps(predictions, indent=2)
    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(formatted)
    return formatted

def export_detections_to_geojson(detections: List[Dict[str, Any]], image_metadata: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Converts normalized detection bounding boxes into standard GeoJSON FeatureCollection.
    """
    features = []
    for idx, det in enumerate(detections):
        box = det.get("bounding_box", det.get("box_2d", [0.2, 0.2, 0.4, 0.4]))
        ymin, xmin, ymax, xmax = box if isinstance(box, list) else [box["ymin"], box["xmin"], box["ymax"], box["xmax"]]

        # Simulated geo-coordinate mapping
        lat_min = 12.9 + (ymin * 0.05)
        lat_max = 12.9 + (ymax * 0.05)
        lon_min = 77.5 + (xmin * 0.05)
        lon_max = 77.5 + (xmax * 0.05)

        polygon_coords = [[
            [lon_min, lat_min],
            [lon_max, lat_min],
            [lon_max, lat_max],
            [lon_min, lat_max],
            [lon_min, lat_min]
        ]]

        features.append({
            "type": "Feature",
            "id": det.get("id", f"det-{idx}"),
            "geometry": {
                "type": "Polygon",
                "coordinates": polygon_coords
            },
            "properties": {
                "label": det.get("label", "Target Object"),
                "confidence": det.get("confidence", 0.90),
                "modality_evidence": det.get("modality_evidence", "Optical + SAR"),
                "area_ha": det.get("area_ha", 10.0)
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "source": "SatQuery AI Remote-Sensing Agent",
            "detection_count": len(features)
        }
    }
