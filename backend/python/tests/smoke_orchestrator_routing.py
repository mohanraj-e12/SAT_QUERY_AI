"""End-to-end smoke: every selected sidebar module returns its own routed analysis.

Run:  cd backend/python && PYTHONPATH=. python tests/smoke_orchestrator_routing.py
"""
import base64
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
from PIL import Image

from agentic_orchestrator import agentic_orchestrator


def make_data_url(split: int = 32) -> str:
    arr = np.zeros((64, 64, 3), dtype=np.uint8)
    arr[:, :split] = [30, 120, 40]   # vegetation-like
    arr[:, split:] = [40, 90, 200]   # water-like
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


PNG_A = make_data_url(32)
PNG_B = make_data_url(48)


def make_image(data_url: str, name: str) -> dict:
    return {
        "file_name": name,
        "file_url": data_url,
        "image_data": data_url,
        "satellite": "Sentinel-2",
        "sensor": "MSI",
        "acquisition_date": "2026-06-15",
    }


IMAGE_A = make_image(PNG_A, "synthetic_a.png")
IMAGE_B = make_image(PNG_B, "synthetic_b.png")

SINGLE_CASES = [
    ("land-cover", "What land-cover classes are present and what is the exact percentage breakdown?"),
    ("object-detection", "Detect and ground all prominent runways, buildings, and infrastructure features"),
    ("disaster-analysis", "Is there evidence of flooding, burn scars, or storm damage in this satellite scene?"),
    ("agriculture-analysis", "How healthy is the vegetation canopy in this agricultural scene?"),
    ("urban-growth", "Calculate built-up area growth percentage using NDBI"),
    ("water-vegetation", "Calculate NDVI, NDWI, and NDBI percentages and verify land versus water split"),
    (None, "How much water is in this image?"),  # no module -> question intent routing
]

for selected, question in SINGLE_CASES:
    params = {"selected_module": selected} if selected else {}
    result = agentic_orchestrator.process_query(
        query=question,
        primary_image=dict(IMAGE_A),
        secondary_image=None,
        input_mode="SINGLE",
        user_params=params,
    )
    route = result.get("module_route")
    payload = result.get("module_result")
    assert route, f"{selected}: missing module_route in response"
    assert payload and payload.get("narrative"), f"{selected}: missing module narrative"
    assert payload.get("result_schema"), f"{selected}: missing result_schema"
    answer = result.get("direct_answer") or ""
    assert answer.strip(), f"{selected}: empty direct_answer"
    print(
        f"{str(selected):18} -> {route['module']:18} "
        f"(source={route['route_source']}, schema={payload['result_schema']})"
    )
    if route["module"] not in ("spectral_indices", "ndbi", "ndvi_health"):
        assert "True NDWI cannot be calculated" not in answer, (
            f"{selected}: NDWI band limitation leaked into a non-spectral module answer"
        )

# Pair path: change detection module
pair_result = agentic_orchestrator.process_query(
    query="Bi-temporal comparative analysis: detect land improvement and urban expansion",
    primary_image=dict(IMAGE_A),
    secondary_image=dict(IMAGE_B),
    input_mode="BITEMPORAL_PAIR",
    user_params={"selected_module": "change-detection"},
)
pair_route = pair_result.get("module_route")
pair_payload = pair_result.get("module_result")
assert pair_route and pair_route.get("module") == "change_detection", pair_route
assert pair_payload and pair_payload.get("narrative"), "pair: missing module narrative"
print(f"{'change-detection':18} -> {pair_route['module']:18} (source={pair_route['route_source']})")

print("E2E SMOKE OK")
