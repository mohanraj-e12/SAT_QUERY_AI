"""Quick smoke test for module routing + analyzers (not part of the suite)."""
import sys

from processing.analysis_router import route_analysis, list_modules, normalize_module
from processing.module_analyzers import run_module_analysis, MODULE_ANALYZERS

ANALYSIS = {
    "available": True,
    "image_type": "multispectral",
    "width": 512,
    "height": 512,
    "total_pixels": 262144,
    "valid_pixel_count": 250000,
    "class_percentages": {
        "water": 12.5, "vegetation": 45.2, "built_up": 18.1,
        "bare_land": 20.0, "other": 4.2,
    },
    "class_pixel_counts": {
        "water": 31250, "vegetation": 113000, "built_up": 45250,
        "bare_land": 50000, "other": 10500,
    },
    "class_availability": {
        "water": True, "vegetation": True, "built_up": True,
        "bare_land": True, "other": True,
    },
    "water_detected": True,
    "vegetation_percentage": 46.0,
    "indices": {
        "ndvi": {"mean": 0.42, "median": 0.45, "minimum": -0.2, "maximum": 0.8, "count": 1000, "formula": "(NIR - Red) / (NIR + Red)"},
        "mndwi": {"mean": 0.11, "median": 0.08, "minimum": -0.6, "maximum": 0.7, "count": 1000, "formula": "(Green - SWIR) / (Green + SWIR)"},
        "ndbi": {"mean": 0.05, "median": 0.03, "minimum": -0.5, "maximum": 0.6, "count": 1000, "formula": "(SWIR - NIR) / (SWIR + NIR)"},
    },
    "ndvi_available": True,
    "band_mapping": {"red": 1, "nir": 2, "green": 3, "swir1": 4},
    "water_index": "MNDWI",
    "method": "Threshold segmentation using mapped NDVI, MNDWI, NDBI",
    "confidence_basis": "Deterministic spectral indices and threshold masks; not a supervised per-pixel classifier.",
    "regions_image_relative": {
        "water": {"xmin": 0.1, "ymin": 0.2, "xmax": 0.4, "ymax": 0.6},
        "vegetation": {"xmin": 0.0, "ymin": 0.0, "xmax": 0.9, "ymax": 0.9},
        "built_up": {"xmin": 0.5, "ymin": 0.5, "xmax": 0.8, "ymax": 0.9},
    },
    "class_regions": {
        "water": {"region_count": 2, "largest_region_percent": 8.1,
                  "bounding_box_image_relative": {"xmin": 0.1, "ymin": 0.2, "xmax": 0.4, "ymax": 0.6}},
        "vegetation": {"region_count": 5, "largest_region_percent": 20.0,
                       "bounding_box_image_relative": {"xmin": 0.0, "ymin": 0.0, "xmax": 0.9, "ymax": 0.9}},
        "built_up": {"region_count": 3, "largest_region_percent": 9.0,
                     "bounding_box_image_relative": {"xmin": 0.5, "ymin": 0.5, "xmax": 0.8, "ymax": 0.9}},
    },
    "georeferencing": {"available": False, "bounds": None},
    "overlays": {},
    "limitations": [],
}

failures = []
print("catalog modules:", len(list_modules().get("modules", [])))
print("analyzers:", len(MODULE_ANALYZERS), sorted(MODULE_ANALYZERS))

for module in sorted(MODULE_ANALYZERS):
    route = route_analysis(question="", selected_module=module, analysis=ANALYSIS)
    assert route["module"] == module, (module, route["module"])
    try:
        payload = run_module_analysis(
            module, ANALYSIS, question="how much water is in this image",
            image_metadata={"mission": "Sentinel-2", "instrument": "MSI"},
            plan=route,
        )
        assert payload["module"] == module
        assert payload["narrative"], f"{module}: empty narrative"
        assert isinstance(payload["key_findings"], list)
    except Exception as exc:  # noqa: BLE001
        failures.append((module, repr(exc)))

# Route by question without a selected module.
for question, expected in [
    ("How much water is in this image?", "water_analysis"),
    ("What is the NDVI of the vegetation?", "spectral_indices"),
    ("Are there buildings in this scene?", "object_detection"),
]:
    route = route_analysis(question=question, selected_module=None, analysis=ANALYSIS)
    print(f"Q: {question!r} -> {route['module']} (source={route['route_source']})")
    if route["module"] != expected:
        failures.append((question, f"routed to {route['module']}, expected {expected}"))

# Band-limited spectral module must report the limitation, non-spectral must not.
rgb_analysis = dict(ANALYSIS, image_type="rgb", indices={}, ndvi_available=False,
                    band_mapping={}, water_index=None, vegetation_percentage=45.2)
rgb_analysis["class_availability"] = {
    "water": True, "vegetation": True, "built_up": True, "bare_land": False, "other": False,
}
route_si = route_analysis(question="", selected_module="spectral_indices", analysis=rgb_analysis)
route_lc = route_analysis(question="", selected_module="land_cover", analysis=rgb_analysis)
print("spectral_indices band limitation:", route_si["band_limitation_reported"])
print("land_cover band limitation:", route_lc["band_limitation_reported"])
if not route_si["band_limitation_reported"]:
    failures.append(("spectral_indices", "expected band limitation on RGB analysis"))
if route_lc["band_limitation_reported"]:
    failures.append(("land_cover", "unexpected band limitation for non-spectral module"))

# Unknown module key falls back to mission_overview, never raises.
fallback = run_module_analysis("does_not_exist", ANALYSIS, question="hi")
if fallback["module"] != "mission_overview":
    failures.append(("fallback", f"got {fallback['module']}"))

if failures:
    print("FAILURES:")
    for name, err in failures:
        print(" -", name, err)
    sys.exit(1)
print("SMOKE OK")
