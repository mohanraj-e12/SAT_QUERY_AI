"""Central analysis router for SatQueryAI.

Maps a sidebar-module selection and/or a natural-language question to the
module-specific Python pipeline that must answer it, together with that
module's band requirements, result schema and response generator.

Design rules enforced here:

* A module-specific request is never converted into a spectral-index
  limitation unless the requested module genuinely depends on those bands
  (``reports_band_limitation``).
* ``NDWI/MNDWI unavailable`` is only ever emitted by the spectral-index
  modules, never as a global fallback.
* Every module keeps its own result schema (see ``result_schema``) instead of
  one generic payload.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, Optional, Tuple

from .topic_interpreter import classify_question_intent


# ---------------------------------------------------------------------------
# Band requirement constants
# ---------------------------------------------------------------------------
NDVI_BANDS = ("red", "nir")
NDWI_BANDS = ("green", "nir")
MNDWI_BANDS = ("green", "swir")
NDBI_BANDS = ("swir", "nir")

BAND_LABELS = {
    "blue": "Blue",
    "green": "Green",
    "red": "Red",
    "nir": "NIR",
    "swir": "SWIR",
}


def _module(
    title: str,
    analysis_intent: str,
    processor: str,
    required_model: str,
    result_schema: str,
    *,
    required_bands: Tuple[str, ...] = (),
    band_requirements: Optional[Dict[str, Any]] = None,
    reports_band_limitation: bool = False,
    spatial: bool = False,
    supports_bitemporal: bool = False,
    requires_second_image: bool = False,
) -> Dict[str, Any]:
    return {
        "title": title,
        "analysis_intent": analysis_intent,
        "required_python_processor": processor,
        "required_bands": required_bands,
        "band_requirements": band_requirements or {},
        "required_model": required_model,
        "result_schema": result_schema,
        "response_generator": f"processing.module_analyzers.{processor}",
        "reports_band_limitation": reports_band_limitation,
        "spatial": spatial,
        "supports_bitemporal": supports_bitemporal,
        "requires_second_image": requires_second_image,
    }


# ---------------------------------------------------------------------------
# Module catalog: one entry per analysis mode exposed by SatQueryAI
# ---------------------------------------------------------------------------
MODULE_CATALOG: Dict[str, Dict[str, Any]] = {
    "mission_overview": _module(
        "Mission Overview",
        "mission_overview",
        "analyze_mission_overview",
        "Deterministic image-derived scene analysis",
        "mission_overview",
    ),
    "geoscope": _module(
        "GeoScope Geospatial Analysis",
        "geospatial_analysis",
        "analyze_geoscope",
        "Deterministic image-derived spatial analysis",
        "geospatial_analysis",
        spatial=True,
        supports_bitemporal=True,
    ),
    "live_aoi": _module(
        "Live AOI Analysis",
        "aoi_analysis",
        "analyze_aoi",
        "Deterministic image-derived AOI analysis",
        "aoi_analysis",
        spatial=True,
    ),
    "map_viewer": _module(
        "Geospatial Map Overlay Analysis",
        "map_visualization",
        "analyze_map_viewer",
        "Deterministic image-derived overlay generation",
        "map_overlay",
        spatial=True,
    ),
    "ai_assistant": _module(
        "AI Vision Assistant",
        "question_routed_analysis",
        "route_question_to_module",
        "Question-aware analysis router",
        "question_routed_analysis",
        supports_bitemporal=True,
    ),
    "vlm": _module(
        "VLM Vision-Language Interpretation",
        "vision_language_interpretation",
        "analyze_vlm",
        "Interpreter over measured Python results (no trained VLM checkpoint present)",
        "vlm_interpretation",
    ),
    "change_detection": _module(
        "Bi-Temporal Change Analysis",
        "change_detection",
        "analyze_change_detection",
        "Deterministic paired-image coverage differencing",
        "change_detection",
        supports_bitemporal=True,
        requires_second_image=True,
    ),
    "spectral_indices": _module(
        "NDVI / NDWI / NDBI Spectral Index Analysis",
        "spectral_index_analysis",
        "analyze_spectral_indices",
        "Radiometric normalised-difference index computation",
        "spectral_indices",
        band_requirements={
            "ndvi": {"bands": NDVI_BANDS, "label": "NDVI"},
            "ndwi": {"bands": NDWI_BANDS, "label": "NDWI"},
            "mndwi": {"bands": MNDWI_BANDS, "label": "MNDWI"},
            "ndbi": {"bands": NDBI_BANDS, "label": "NDBI"},
        },
        reports_band_limitation=True,
        supports_bitemporal=True,
    ),
    "land_cover": _module(
        "Land Cover Classification",
        "land_cover_analysis",
        "analyze_land_cover",
        "Deterministic threshold class masks (no supervised CLC-19 checkpoint present)",
        "land_cover",
        supports_bitemporal=True,
    ),
    "object_detection": _module(
        "Object Detection",
        "object_detection_analysis",
        "analyze_objects",
        "Region-level class-mask delineation (no trained object detector checkpoint present)",
        "object_detection",
        spatial=True,
    ),
    "sam_segmentation": _module(
        "SAM Segmentation",
        "sam_segmentation",
        "analyze_sam_segmentation",
        "SAM segmenter (used only when weights genuinely load)",
        "sam_segmentation",
        spatial=True,
    ),
    "disaster": _module(
        "Disaster Analysis",
        "disaster_analysis",
        "analyze_disaster",
        "Deterministic hazard-evidence screening (no validated burn/flood detector checkpoint present)",
        "disaster",
        spatial=True,
        supports_bitemporal=True,
    ),
    "agriculture": _module(
        "Agriculture Analysis",
        "agriculture_analysis",
        "analyze_agriculture",
        "Deterministic vegetation/soil indicator analysis (no crop classifier checkpoint present)",
        "agriculture",
        band_requirements={"ndvi": {"bands": NDVI_BANDS, "label": "NDVI"}},
        spatial=True,
        supports_bitemporal=True,
    ),
    "ndvi_health": _module(
        "NDVI Health (Vegetation Condition)",
        "ndvi_health_analysis",
        "analyze_ndvi_health",
        "Measured NDVI with a documented RGB vegetation-estimate fallback",
        "ndvi_health",
        required_bands=NDVI_BANDS,
        band_requirements={"ndvi": {"bands": NDVI_BANDS, "label": "NDVI"}},
        supports_bitemporal=True,
    ),
    "urban_growth": _module(
        "Urban Growth Analysis",
        "urban_growth_analysis",
        "analyze_urban_growth",
        "Deterministic built-up coverage analysis (growth requires two dates)",
        "urban_growth",
        spatial=True,
        supports_bitemporal=True,
    ),
    "ndbi": _module(
        "NDBI Built-up Index Analysis",
        "ndbi_analysis",
        "analyze_ndbi",
        "Radiometric NDBI computation",
        "ndbi",
        required_bands=NDBI_BANDS,
        band_requirements={"ndbi": {"bands": NDBI_BANDS, "label": "NDBI"}},
        reports_band_limitation=True,
        supports_bitemporal=True,
    ),
    "water_vegetation": _module(
        "Water & Vegetation Analysis",
        "water_vegetation_analysis",
        "analyze_water_vegetation",
        "Deterministic water/vegetation coverage comparison",
        "water_vegetation",
        spatial=True,
        supports_bitemporal=True,
    ),
    "water_analysis": _module(
        "Water Analysis",
        "water_analysis",
        "analyze_water_analysis",
        "Deterministic water coverage analysis",
        "water_analysis",
        spatial=True,
    ),
    "vegetation_analysis": _module(
        "Vegetation Analysis",
        "vegetation_analysis",
        "analyze_vegetation_analysis",
        "Deterministic vegetation coverage analysis",
        "vegetation_analysis",
        spatial=True,
    ),
    "urban_analysis": _module(
        "Built-up Coverage Analysis",
        "built_up_analysis",
        "analyze_urban_analysis",
        "Deterministic built-up coverage analysis",
        "built_up_analysis",
        spatial=True,
        supports_bitemporal=True,
    ),
}


# ---------------------------------------------------------------------------
# Question intent (topic_interpreter) -> module
# ---------------------------------------------------------------------------
INTENT_TO_MODULE: Dict[str, str] = {
    "complete_analysis": "mission_overview",
    "urban_growth": "urban_growth",
    "change_detection": "change_detection",
    "flood": "disaster",
    "disaster": "disaster",
    "fire": "disaster",
    "ndwi": "spectral_indices",
    "ndvi": "spectral_indices",
    "ndbi": "ndbi",
    "object_detection": "object_detection",
    "land_cover": "land_cover",
    "agriculture": "agriculture",
    "vegetation_health": "ndvi_health",
    "water_vegetation_comparison": "water_vegetation",
    "vegetation": "vegetation_analysis",
    "built_up": "urban_analysis",
    "water_detection": "water_analysis",
    "water_coverage": "water_analysis",
}

# Sidebar labels / user-facing aliases -> canonical module key
MODULE_ALIASES: Dict[str, str] = {}
for _key, _entry in MODULE_CATALOG.items():
    MODULE_ALIASES[_key] = _key
    MODULE_ALIASES[_entry["title"].lower()] = _key

MODULE_ALIASES.update({
    "overview": "mission_overview",
    "mission-overview": "mission_overview",
    "dashboard": "mission_overview",
    "geo scope": "geoscope",
    "live aoi": "live_aoi",
    "aoi": "live_aoi",
    "live-aoi": "live_aoi",
    "map viewer": "map_viewer",
    "geospatial map viewer": "map_viewer",
    "explore": "map_viewer",
    "ai vision assistant": "ai_assistant",
    "ai assistant": "ai_assistant",
    "assistant": "ai_assistant",
    "vlm ai": "vlm",
    "bi-temporal change": "change_detection",
    "bitemporal change": "change_detection",
    "change": "change_detection",
    "ndvi/ndwi": "spectral_indices",
    "ndvi ndwi": "spectral_indices",
    "spectral index": "spectral_indices",
    "spectral indices": "spectral_indices",
    "land-cover": "land_cover",
    "land cover": "land_cover",
    "objects": "object_detection",
    "sam": "sam_segmentation",
    "segment anything": "sam_segmentation",
    "disaster analysis": "disaster",
    "ndvi health": "ndvi_health",
    "vegetation health": "ndvi_health",
    "urban growth": "urban_growth",
    "water & vegetation analysis": "water_vegetation",
    "water and vegetation": "water_vegetation",
    "water vegetation": "water_vegetation",
    "water": "water_analysis",
    "vegetation": "vegetation_analysis",
    "built-up": "urban_analysis",
    "built up": "urban_analysis",
    "built-up analysis": "urban_analysis",
})


def normalize_module(value: Optional[str]) -> Optional[str]:
    """Resolve a module key, title or alias to a canonical catalog key."""
    if not value or not isinstance(value, str):
        return None
    key = " ".join(value.strip().lower().replace("_", " ").replace("-", " ").split())
    if not key:
        return None
    if key in MODULE_CATALOG:
        return key
    if key in MODULE_ALIASES:
        return MODULE_ALIASES[key]
    underscored = key.replace(" ", "_")
    if underscored in MODULE_CATALOG:
        return underscored
    return MODULE_ALIASES.get(underscored)


def module_for_intent(intent: str) -> str:
    """Map a question intent to the module that must answer it."""
    return INTENT_TO_MODULE.get(intent, "mission_overview")


def available_band_roles(analysis: Optional[Dict[str, Any]]) -> Tuple[str, ...]:
    """Return the mapped spectral band roles actually present in the image."""
    if not analysis:
        return ()
    return tuple(sorted((analysis.get("band_mapping") or {}).keys()))


def _band_label(role: str) -> str:
    return BAND_LABELS.get(role, role.upper())


def spectral_band_limitation(
    unresolved_indices: Iterable[str],
    band_status: Dict[str, Any],
) -> str:
    """Build the band-availability sentence for spectral-index modules only."""
    parts = []
    for name in unresolved_indices:
        item = band_status["per_index"].get(name)
        if not item:
            continue
        missing = " and ".join(_band_label(role) for role in item["missing_bands"])
        parts.append(f"{item['label']} requires the {missing} band(s)")
    if not parts:
        return "The requested spectral index cannot be calculated from the available image bands."
    return "; ".join(parts) + "."


def module_band_status(
    module: str,
    analysis: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """Report which of a module's bands are present, per index where relevant."""
    entry = MODULE_CATALOG.get(module, {})
    requirements: Dict[str, Any] = entry.get("band_requirements") or {}
    available = available_band_roles(analysis)
    status: Dict[str, Any] = {}
    for name, requirement in requirements.items():
        required = tuple(requirement["bands"])
        missing = tuple(role for role in required if role not in available)
        status[name] = {
            "label": requirement.get("label", name.upper()),
            "required_bands": list(required),
            "available": not missing,
            "missing_bands": list(missing),
        }
    required_bands = tuple(entry.get("required_bands") or ())
    missing_required = tuple(role for role in required_bands if role not in available)
    return {
        "available_bands": list(available),
        "per_index": status,
        "required_bands": list(required_bands),
        "missing_bands": list(missing_required),
        "band_requirements_met": not missing_required,
    }


def route_analysis(
    question: str = "",
    selected_module: Optional[str] = None,
    analysis: Optional[Dict[str, Any]] = None,
    image_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Route an image + question + selected module to a module-specific pipeline.

    Returns the routing decision (module, processor, bands, schema, generator)
    plus the honest band status for that module only.
    """
    requested = normalize_module(selected_module)
    question_intent = classify_question_intent(question or "")

    if requested and requested not in ("ai_assistant", "vlm"):
        module = requested
        route_source = "selected_module"
    elif requested in ("ai_assistant", "vlm"):
        module = module_for_intent(question_intent) if (question or "").strip() else requested
        route_source = "question_intent" if (question or "").strip() else "selected_module"
    else:
        module = module_for_intent(question_intent)
        route_source = "question_intent"

    entry = MODULE_CATALOG[module]
    band_status = module_band_status(module, analysis)

    band_limitation_message: Optional[str] = None
    if entry.get("reports_band_limitation"):
        unresolved = [
            name for name, item in band_status["per_index"].items() if not item["available"]
        ]
        if unresolved:
            band_limitation_message = spectral_band_limitation(unresolved, band_status)

    return {
        "module": module,
        "module_title": entry["title"],
        "requested_module": requested,
        "route_source": route_source,
        "analysis_intent": entry["analysis_intent"],
        "question_intent": question_intent,
        "question": question,
        "required_bands": band_status["required_bands"],
        "available_bands": band_status["available_bands"],
        "missing_bands": band_status["missing_bands"],
        "band_requirements_met": band_status["band_requirements_met"],
        "index_band_status": band_status["per_index"],
        "band_limitation_reported": band_limitation_message is not None,
        "band_limitation_message": band_limitation_message,
        "required_model": entry["required_model"],
        "required_python_processor": entry["required_python_processor"],
        "result_schema": entry["result_schema"],
        "response_generator": entry["response_generator"],
        "spatial": bool(entry.get("spatial")),
        "supports_bitemporal": bool(entry.get("supports_bitemporal")),
        "requires_second_image": bool(entry.get("requires_second_image")),
        "image_metadata_available": bool(image_metadata),
    }


def list_modules() -> Dict[str, Any]:
    """Expose the module catalog for diagnostics and UI labelling."""
    return {
        "modules": [
            {
                "module": key,
                "title": entry["title"],
                "analysis_intent": entry["analysis_intent"],
                "required_python_processor": entry["required_python_processor"],
                "required_bands": list(entry["required_bands"]),
                "result_schema": entry["result_schema"],
                "reports_band_limitation": bool(entry.get("reports_band_limitation")),
                "supports_bitemporal": bool(entry.get("supports_bitemporal")),
            }
            for key, entry in MODULE_CATALOG.items()
        ],
        "intent_to_module": dict(INTENT_TO_MODULE),
    }
