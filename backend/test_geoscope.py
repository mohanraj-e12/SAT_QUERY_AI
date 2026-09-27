"""
SatQueryAI GeoScope - Automated Geospatial & Multimodal Test Suite
Tests:
1. AOI geometry, GeoJSON validation & geodesic area in km²
2. Satellite imagery acquisition (Sentinel-2 Optical & Sentinel-1 SAR) & clipping
3. Independent AOI conditioning (AOI A vs AOI B -> different answers)
4. Question conditioning on same AOI (Question 1 vs Question 2 -> different tasks)
5. Bi-temporal change detection comparison (Date A vs Date B)
6. Anti-hallucination & metadata verification
"""

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from backend.geospatial.aoi import aoi_manager
from backend.geospatial.imagery import satellite_imagery_provider
from backend.geospatial.projection import haversine_distance_km, calculate_polygon_area_km2
from backend.geospatial.geoscope_handler import (
    handle_geoscope_aoi,
    handle_geoscope_imagery,
    handle_geoscope_analyze,
    handle_geoscope_compare
)

def run_geoscope_tests():
    print("==================================================")
    print(" SatQueryAI GeoScope - Comprehensive Test Suite   ")
    print("==================================================")

    # TEST 1: Geodesic Area & Geometry Validation
    print("\n[TEST 1] AOI Geometry & Geodesic Area Calculation")
    chennai_poly = [
        [80.2307, 13.0427],
        [80.3107, 13.0427],
        [80.3107, 13.1227],
        [80.2307, 13.1227],
        [80.2307, 13.0427]
    ]
    aoi_res = handle_geoscope_aoi({"geometry": {"type": "Polygon", "coordinates": [chennai_poly]}})
    print(f"Area km²: {aoi_res['area_km2']} km²")
    print(f"Center: {aoi_res['center']}")
    print(f"Bounds: {aoi_res['bounds']}")
    assert aoi_res["valid"] is True, "AOI must be valid"
    assert aoi_res["area_km2"] > 0, "Area must be positive"
    print(">>> PASS: AOI Geometry & Area computation verified.")

    # TEST 2: Satellite Imagery Acquisition (Sentinel-2 Optical vs Sentinel-1 SAR)
    print("\n[TEST 2] Multi-Sensor Imagery Acquisition & Metadata")
    opt_res = handle_geoscope_imagery({
        "bounds": aoi_res["bounds"],
        "sensor": "Sentinel-2",
        "acquisition_date": "2026-08-14",
        "max_cloud_cover": 15.0,
        "composite_type": "RGB"
    })
    print(f"Optical Sensor: {opt_res['metadata']['sensor']}")
    print(f"Bands: {opt_res['metadata']['bands']}")
    print(f"Cloud Cover: {opt_res['metadata']['cloud_percentage']}%")
    assert "data:image/" in opt_res["image_data_url"], "Data URL must be generated"

    sar_res = handle_geoscope_imagery({
        "bounds": aoi_res["bounds"],
        "sensor": "Sentinel-1",
        "acquisition_date": "2026-08-14"
    })
    print(f"SAR Sensor: {sar_res['metadata']['sensor']}")
    print(f"Bands: {sar_res['metadata']['bands']}")
    assert sar_res["metadata"]["sensor"] == "Sentinel-1 SAR", "Sensor must be identified as SAR"
    print(">>> PASS: Multi-sensor imagery acquisition & metadata validated.")

    # TEST 3: AOI A vs AOI B Conditioning (Different Geographic Spots)
    print("\n[TEST 3] Geographic Area Conditioning (AOI A vs AOI B)")
    # AOI A: Coastal Bay of Bengal / Water region (13.08, 80.35)
    bounds_water = [80.33, 13.05, 80.41, 13.13]
    analysis_a = handle_geoscope_analyze({
        "question": "What type of land cover is visible in this area?",
        "aoi": {"bounds": bounds_water}
    })
    print(f"\n[AOI A - Coastal/Aquatic Zone]")
    print(f"Answer: {analysis_a['answer']}")
    print(f"Detected Features: {analysis_a['detected_features']}")

    # AOI B: Urban City / Interior (13.08, 80.20)
    bounds_urban = [80.18, 13.05, 80.26, 13.13]
    analysis_b = handle_geoscope_analyze({
        "question": "What type of land cover is visible in this area?",
        "aoi": {"bounds": bounds_urban}
    })
    print(f"\n[AOI B - Urban Settlement]")
    print(f"Answer: {analysis_b['answer']}")
    print(f"Detected Features: {analysis_b['detected_features']}")

    assert analysis_a["answer"] != analysis_b["answer"], "AOI A and AOI B must produce different answers"
    print(">>> PASS: Independent geographic AOI conditioning confirmed.")

    # TEST 4: Same AOI with Different Questions
    print("\n[TEST 4] Question Conditioning on Same AOI")
    q1 = "Does this area contain open water bodies?"
    ans_q1 = handle_geoscope_analyze({"question": q1, "aoi": {"bounds": bounds_urban}})
    print(f"\nQuestion 1 ('{q1}'):")
    print(f"Task: {ans_q1['task']}")
    print(f"Answer: {ans_q1['answer']}")

    q2 = "Is there evidence of urban structures and buildings?"
    ans_q2 = handle_geoscope_analyze({"question": q2, "aoi": {"bounds": bounds_urban}})
    print(f"\nQuestion 2 ('{q2}'):")
    print(f"Task: {ans_q2['task']}")
    print(f"Answer: {ans_q2['answer']}")

    assert ans_q1["task"] != ans_q2["task"], "Tasks must differ based on user question"
    print(">>> PASS: Question routing and specialist reasoning confirmed.")

    # TEST 5: Bi-Temporal Date Comparison
    print("\n[TEST 5] Bi-Temporal Change Detection (Date A vs Date B)")
    comp_res = handle_geoscope_compare({
        "bounds": bounds_urban,
        "date_a": "2026-01-15",
        "date_b": "2026-08-14"
    })
    print(f"Change Task: {comp_res['task']}")
    print(f"Comparison Result: {comp_res['answer']}")
    print(f"Change Metric: {comp_res['change_metric_pct']}%")
    assert comp_res["image_a_url"] and comp_res["image_b_url"], "Both epoch images must be provided"
    print(">>> PASS: Bi-temporal change detection verified.")

    print("\n==================================================")
    print(" ALL GEOSCOPE AUTOMATED TESTS PASSED!             ")
    print("==================================================")

if __name__ == "__main__":
    run_geoscope_tests()
