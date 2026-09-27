"""Module-specific remote-sensing analysis pipelines for SatQueryAI.

Each module owns its own analysis logic and its own result schema. All modules
consume the single shared :func:`processing.image_analysis.analyze_satellite_image`
measurement (see ``analysis`` argument) so that numbers stay consistent across
modules, while explanations, metrics and payloads stay module-specific.

Every analyzer returns::

    {
      "module": "land_cover",
      "module_title": "Land Cover Classification",
      "result_schema": "land_cover",
      "available": True,
      "result": {...},          # module-specific schema
      "narrative": "**...**",   # AI explanation grounded in measured values
      "evidence": [...],
      "method": "...",
      "limitations": [...],
      "key_findings": [...],
    }
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .analysis_router import MODULE_CATALOG, module_band_status

AVAILABLE = "unavailable"

CLASS_ORDER = ("water", "vegetation", "built_up", "bare_land", "other")

CLASS_LABELS = {
    "water": "Water",
    "vegetation": "Vegetation",
    "built_up": "Built-up",
    "bare_land": "Bare land",
    "other": "Other",
}


# ---------------------------------------------------------------------------
# Shared formatting helpers (no measurements are invented here)
# ---------------------------------------------------------------------------
def _percent(value: Any) -> str:
    if value is None:
        return AVAILABLE
    try:
        return f"{float(value):.2f}%"
    except (TypeError, ValueError):
        return AVAILABLE


def _number(value: Any, digits: int = 3) -> str:
    if value is None:
        return AVAILABLE
    try:
        return f"{float(value):.{digits}f}"
    except (TypeError, ValueError):
        return AVAILABLE


def _index_block(analysis: Dict[str, Any], name: str) -> Optional[Dict[str, Any]]:
    return (analysis.get("indices") or {}).get(name)


def _index_stats(analysis: Dict[str, Any], name: str) -> str:
    label = name.upper()
    index = _index_block(analysis, name)
    if not index:
        return f"{label}: {AVAILABLE}"
    return (
        f"{label}: mean {_number(index['mean'])}, median {_number(index['median'])}, "
        f"min {_number(index['minimum'])}, max {_number(index['maximum'])} "
        f"({index.get('formula')})"
    )


def _available_class_names(analysis: Dict[str, Any]) -> List[str]:
    availability = analysis.get("class_availability") or {}
    return [name for name in CLASS_ORDER if availability.get(name)]


def _class_lines(analysis: Dict[str, Any]) -> List[str]:
    classes = analysis.get("class_percentages") or {}
    availability = analysis.get("class_availability") or {}
    lines = []
    for name in CLASS_ORDER:
        if availability.get(name):
            lines.append(f"- {CLASS_LABELS[name]}: {_percent(classes.get(name))}")
        else:
            lines.append(f"- {CLASS_LABELS[name]}: {AVAILABLE} (required image evidence missing)")
    return lines


def _dominant_class(analysis: Dict[str, Any]) -> Optional[str]:
    classes = analysis.get("class_percentages") or {}
    availability = analysis.get("class_availability") or {}
    measured = {
        name: classes.get(name)
        for name in CLASS_ORDER
        if availability.get(name) and classes.get(name) is not None
    }
    if not measured:
        return None
    return max(measured, key=lambda name: measured[name])


def _region_envelope(analysis: Dict[str, Any], class_name: str) -> Optional[str]:
    region = (analysis.get("regions_image_relative") or {}).get(class_name)
    if not region:
        return None
    return (
        f"x {region['xmin'] * 100:.0f}%-{region['xmax'] * 100:.0f}%, "
        f"y {region['ymin'] * 100:.0f}%-{region['ymax'] * 100:.0f}%"
    )


def _region_summary(analysis: Dict[str, Any], class_name: str) -> Optional[Dict[str, Any]]:
    return (analysis.get("class_regions") or {}).get(class_name)


def _image_type_label(analysis: Dict[str, Any]) -> str:
    if analysis.get("image_type") == "rgb":
        return "RGB optical image (3 rendered channels)"
    bands = analysis.get("band_mapping") or {}
    if bands:
        names = ", ".join(f"band {index} = {role.upper()}" for role, index in sorted(bands.items()))
        return f"multispectral raster with mapped bands ({names})"
    return "multispectral raster with no mapped band roles"


def _acquisition_text(image_metadata: Optional[Dict[str, Any]], analysis: Dict[str, Any]) -> str:
    """Describe the acquisition only as far as the upload metadata supports it."""
    meta = image_metadata or {}
    parts = [_image_type_label(analysis)]
    platform = meta.get("satellite") or meta.get("platform")
    sensor = meta.get("sensor") or meta.get("sensor_type")
    if platform and sensor:
        parts.append(f"platform recorded in metadata: {platform} / {sensor}")
    elif platform:
        parts.append(f"platform recorded in metadata: {platform}")
    elif sensor:
        parts.append(f"sensor recorded in metadata: {sensor}")
    else:
        parts.append("no satellite or sensor metadata was supplied with this upload")
    resolution = meta.get("resolution_meters")
    if resolution:
        parts.append(f"recorded ground sample distance: {resolution} m/pixel")
    else:
        parts.append("no ground sample distance is recorded, so no metric ground-scale claim is made")
    parts.append(
        f"measured on a {analysis.get('width')}x{analysis.get('height')} working grid "
        f"({analysis.get('valid_pixel_count')} valid pixels)"
    )
    return "; ".join(parts)


def _georeferencing_text(analysis: Dict[str, Any]) -> str:
    georef = analysis.get("georeferencing") or {}
    bounds = georef.get("bounds")
    if georef.get("available") and bounds:
        return (
            f"Geographic bounds are available from {bounds.get('source', 'image metadata')}: "
            f"west {bounds['west']:.4f}, south {bounds['south']:.4f}, "
            f"east {bounds['east']:.4f}, north {bounds['north']:.4f} ({bounds.get('crs')})."
        )
    return (
        "Geographic coordinates are unavailable for this image; locations are reported "
        "image-relative (normalized 0-1)."
    )


def _method_limitations(analysis: Dict[str, Any]) -> List[str]:
    limitations = [str(analysis.get("confidence_basis") or "").strip()]
    if analysis.get("image_type") == "rgb":
        limitations.append(
            "RGB colour heuristics cannot provide true spectral indices; surface classes are estimates."
        )
    else:
        limitations.append(
            "Threshold masks are not calibrated to a sensor, biome or ground-truth dataset."
        )
    return [item for item in limitations if item]


def _plan_limitation(plan: Optional[Dict[str, Any]]) -> Optional[str]:
    if not plan:
        return None
    message = plan.get("band_limitation_message")
    if message and plan.get("band_limitation_reported"):
        return message
    return None


def _module_meta(module: str) -> Dict[str, Any]:
    entry = MODULE_CATALOG.get(module, {})
    return {
        "module": module,
        "module_title": entry.get("title", module.replace("_", " ").title()),
        "result_schema": entry.get("result_schema", module),
    }


def _payload(
    module: str,
    *,
    available: bool,
    result: Dict[str, Any],
    narrative: str,
    evidence: List[str],
    method: str,
    limitations: List[str],
    key_findings: List[str],
    plan: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    payload = {
        **_module_meta(module),
        "available": available,
        "result": result,
        "narrative": narrative,
        "evidence": [item for item in evidence if item],
        "method": method,
        "limitations": [item for item in limitations if item],
        "key_findings": [item for item in key_findings if item],
    }
    if plan is not None:
        payload["route"] = {
            "requested_module": plan.get("requested_module"),
            "route_source": plan.get("route_source"),
            "analysis_intent": plan.get("analysis_intent"),
            "question_intent": plan.get("question_intent"),
            "required_python_processor": plan.get("required_python_processor"),
            "required_bands": plan.get("required_bands"),
            "available_bands": plan.get("available_bands"),
            "missing_bands": plan.get("missing_bands"),
            "band_requirements_met": plan.get("band_requirements_met"),
            "required_model": plan.get("required_model"),
        }
    return payload


def _detection_bullet(analysis: Dict[str, Any], class_name: str, label: str) -> str:
    availability = (analysis.get("class_availability") or {}).get(class_name)
    classes = analysis.get("class_percentages") or {}
    if not availability:
        return f"• {label}: not measurable from the available image evidence"
    regions = _region_summary(analysis, class_name) or {}
    envelope = _region_envelope(analysis, class_name)
    detail = f"{_percent(classes.get(class_name))} of the analyzed area"
    if regions.get("region_count"):
        detail += f", {regions['region_count']} distinct region(s)"
    if envelope:
        detail += f", image-relative extent {envelope}"
    return f"• {label} detected: {detail}"


def analyze_mission_overview(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """High-level interpretation of the uploaded scene (no index forced)."""
    available = _available_class_names(analysis)
    dominant = _dominant_class(analysis)
    classes = analysis.get("class_percentages") or {}
    observations = [
        _detection_bullet(analysis, "water", "Water regions"),
        _detection_bullet(analysis, "vegetation", "Vegetation regions"),
        _detection_bullet(analysis, "built_up", "Built-up regions"),
    ]
    vegetation_pct = classes.get("vegetation") if "vegetation" in available else None
    bare_pct = classes.get("bare_land") if "bare_land" in available else None
    if vegetation_pct is None and bare_pct is None:
        observations.append("• Agricultural patterns: not separable from the available image evidence")
    else:
        observations.append(
            "• Agricultural patterns: no crop type is identifiable, but "
            f"vegetation-like cover {_percent(vegetation_pct)} together with open/bare surface "
            f"{_percent(bare_pct)} form the agricultural-pattern proxy"
        )

    if dominant:
        dominant_text = f"{CLASS_LABELS[dominant]}-dominant scene ({_percent(classes.get(dominant))})"
    else:
        dominant_text = "Not determinable from the available image evidence"

    summary = (
        f"The uploaded image is analyzed as a {_image_type_label(analysis)} covering "
        f"{analysis.get('valid_pixel_count')} valid pixels. "
        + (
            f"The dominant surface class is {CLASS_LABELS[dominant]}."
            if dominant
            else "No surface class could be measured from the available image evidence."
        )
    )
    narrative = (
        "**Mission Overview**\n\n"
        f"Scene Summary: {summary}\n\n"
        "Major Observations:\n" + "\n".join(observations) + "\n\n"
        f"Dominant Surface: {dominant_text}\n\n"
        f"Measured Class Distribution:\n" + "\n".join(_class_lines(analysis)) + "\n\n"
        f"Key Evidence: {analysis.get('method')}. {_acquisition_text(image_metadata, analysis)}. "
        f"{_georeferencing_text(analysis)}\n\n"
        f"Data Limitations: {analysis.get('confidence_basis')} "
        "No supervised land-cover classifier or trained object detector is available for this scene."
    )

    return _payload(
        "mission_overview",
        available=True,
        result={
            "scene_summary": summary,
            "dominant_surface": dominant,
            "class_percentages": {
                name: classes.get(name) if name in available else None for name in CLASS_ORDER
            },
            "detected_regions": {
                name: _region_summary(analysis, name) for name in ("water", "vegetation", "built_up")
            },
            "image_type": analysis.get("image_type"),
            "valid_pixel_count": analysis.get("valid_pixel_count"),
        },
        narrative=narrative,
        evidence=[
            f"Dominant class: {CLASS_LABELS[dominant] if dominant else AVAILABLE}",
            f"Method: {analysis.get('method')}",
            _acquisition_text(image_metadata, analysis),
        ],
        method=analysis.get("method", ""),
        limitations=_method_limitations(analysis),
        key_findings=[line.lstrip("- ") for line in _class_lines(analysis)],
        plan=plan,
    )


def _spatial_lines(analysis: Dict[str, Any]) -> List[str]:
    lines = []
    for name in ("water", "vegetation", "built_up"):
        if not (analysis.get("class_availability") or {}).get(name):
            lines.append(f"• {CLASS_LABELS[name]}: position unavailable")
            continue
        envelope = _region_envelope(analysis, name)
        regions = _region_summary(analysis, name) or {}
        if envelope:
            lines.append(
                f"• {CLASS_LABELS[name]}: image-relative extent {envelope}; "
                f"{regions.get('region_count', 0)} distinct region(s), "
                f"largest region {_percent(regions.get('largest_region_share_percent'))} of that mask"
            )
        else:
            lines.append(f"• {CLASS_LABELS[name]}: no pixels of this class were measured")
    return lines


def _where_answer(analysis: Dict[str, Any], question: str) -> Optional[str]:
    q = (question or "").lower()
    targets = []
    if any(term in q for term in ("water", "lake", "river", "reservoir", "flood")):
        targets.append("water")
    if any(term in q for term in ("vegetation", "green", "forest", "tree", "crop")):
        targets.append("vegetation")
    if any(term in q for term in ("built", "urban", "building", "city", "infrastructure")):
        targets.append("built_up")
    if not targets:
        return None
    parts = []
    for name in targets:
        envelope = _region_envelope(analysis, name)
        if envelope:
            parts.append(f"{CLASS_LABELS[name]} occupies image-relative extent {envelope}")
        else:
            parts.append(
                f"{CLASS_LABELS[name]} has no measured pixels in this image "
                f"({_percent((analysis.get('class_percentages') or {}).get(name))})"
            )
    prefix = (
        "Where, in image-relative coordinates: "
        if not (analysis.get("georeferencing") or {}).get("available")
        else "Where, in image-relative coordinates (no reliable geographic placement is claimed): "
    )
    return prefix + "; ".join(parts) + "."


def _largest_region(analysis: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    candidates = []
    classes = analysis.get("class_percentages") or {}
    for name in ("water", "vegetation", "built_up", "bare_land"):
        if not (analysis.get("class_availability") or {}).get(name):
            continue
        percent = classes.get(name)
        if percent is None or percent <= 0:
            continue
        candidates.append({"class": name, "coverage_percent": percent})
    if not candidates:
        return None
    return max(candidates, key=lambda item: item["coverage_percent"])


def analyze_geoscope(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """Geospatial exploration/interpretation of the uploaded image (or AOI)."""
    meta = image_metadata or {}
    georef = analysis.get("georeferencing") or {}
    largest = _largest_region(analysis)
    where = _where_answer(analysis, question)

    result = {
        "georeferencing_available": bool(georef.get("available")),
        "bounds": georef.get("bounds"),
        "image_bounds_source": (georef.get("bounds") or {}).get("source") if georef.get("available") else None,
        "aoi_bounds_from_request": meta.get("bbox"),
        "detected_regions": {
            name: {
                "coverage_percent": (analysis.get("class_percentages") or {}).get(name)
                if (analysis.get("class_availability") or {}).get(name)
                else None,
                "image_relative_envelope": _region_envelope(analysis, name),
                **( _region_summary(analysis, name) or {}),
            }
            for name in ("water", "vegetation", "built_up")
        },
        "largest_measured_region": largest,
        "working_grid": [analysis.get("width"), analysis.get("height")],
        "coordinate_frame": "geographic (EPSG:4326 metadata)" if georef.get("available") else "image-relative",
    }

    narrative = (
        "**GeoScope Spatial Interpretation**\n\n"
        f"Scene: {_image_type_label(analysis)}; {analysis.get('valid_pixel_count')} analyzed pixels. "
        f"{_georeferencing_text(analysis)}\n\n"
        "Detected Regions and Placement:\n" + "\n".join(_spatial_lines(analysis)) + "\n\n"
        + (
            f"Where: {where}\n\n" if where else ""
        )
        + (
            f"Largest Measured Region: {CLASS_LABELS[largest['class']]} at {_percent(largest['coverage_percent'])} "
            "of the analyzed area.\n\n"
            if largest
            else "Largest Measured Region: none could be measured.\n\n"
        )
        + f"Evidence: {analysis.get('method')}; {analysis.get('confidence_basis')}\n\n"
        "Limitations: Map placement reflects class-mask envelopes computed from this image. "
        + (
            "Geographic coordinates come only from the image metadata that was supplied."
            if georef.get("available")
            else "No reliable georeferencing exists, so no latitude/longitude is reported."
        )
    )

    return _payload(
        "geoscope",
        available=True,
        result=result,
        narrative=narrative,
        evidence=[
            _georeferencing_text(analysis),
            f"Method: {analysis.get('method')}",
            f"Measured regions: {len(analysis.get('regions_image_relative') or {})}",
        ],
        method=analysis.get("method", ""),
        limitations=_method_limitations(analysis) + [
            "Class-region envelopes are image-relative unless trustworthy georeferencing exists."
        ],
        key_findings=_spatial_lines(analysis),
        plan=plan,
    )


def analyze_aoi(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """Live AOI module: describe the selected area of interest and its content."""
    meta = image_metadata or {}
    georef = analysis.get("georeferencing") or {}
    aoi_bbox = meta.get("bbox")
    classes = analysis.get("class_percentages") or {}

    footprint = (
        f"geographic bounds {georef['bounds']} ({georef['bounds'].get('crs')})"
        if georef.get("available")
        else "image footprint only; geographic coordinates are unavailable for this image"
    )
    result = {
        "aoi_bbox": aoi_bbox if isinstance(aoi_bbox, dict) else None,
        "image_footprint": footprint,
        "georeferencing_available": bool(georef.get("available")),
        "land_cover_distribution": {
            name: classes.get(name) if (analysis.get("class_availability") or {}).get(name) else None
            for name in CLASS_ORDER
        },
        "detected_features": [
            name
            for name in ("water", "vegetation", "built_up", "bare_land")
            if (analysis.get("class_availability") or {}).get(name) and (classes.get(name) or 0) > 0
        ],
        "regions": {
            name: _region_summary(analysis, name) for name in ("water", "vegetation", "built_up")
        },
    }

    narrative = (
        "**Live AOI Analysis**\n\n"
        f"AOI Footprint: {footprint}. Analyzed {analysis.get('valid_pixel_count')} valid pixels "
        f"on a {analysis.get('width')}x{analysis.get('height')} working grid.\n\n"
        "Land-cover Distribution inside the AOI:\n" + "\n".join(_class_lines(analysis)) + "\n\n"
        "Detected Features:\n"
        + (
            "\n".join(f"• {item}" for item in result["detected_features"])
            if result["detected_features"]
            else "• No class above zero coverage could be measured inside this AOI."
        )
        + "\n\n"
        f"Evidence: {analysis.get('method')}. {_georeferencing_text(analysis)}\n\n"
        f"Limitations: {analysis.get('confidence_basis')} "
        "AOI content is derived from the uploaded image pixels only; no external AOI boundary data is mixed in."
    )

    return _payload(
        "live_aoi",
        available=True,
        result=result,
        narrative=narrative,
        evidence=[
            f"Footprint: {footprint}",
            f"Method: {analysis.get('method')}",
            f"Valid pixels analyzed: {analysis.get('valid_pixel_count')}",
        ],
        method=analysis.get("method", ""),
        limitations=_method_limitations(analysis),
        key_findings=[line.lstrip("- ") for line in _class_lines(analysis)],
        plan=plan,
    )


def analyze_map_viewer(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """Geospatial map viewer module: overlay inventory from the real analysis."""
    overlays = analysis.get("overlays") or {}
    layer_names = [name for name in overlays if name]
    result = {
        "overlay_layers": layer_names,
        "land_cover_overlay_available": "land_cover" in overlays,
        "index_overlays_available": [name for name in overlays if name != "land_cover"],
        "regions": {
            name: {
                "image_relative_envelope": _region_envelope(analysis, name),
                **(_region_summary(analysis, name) or {}),
            }
            for name in ("water", "vegetation", "built_up")
        },
        "coordinate_frame": "geographic" if (analysis.get("georeferencing") or {}).get("available") else "image-relative",
    }

    narrative = (
        "**Geospatial Map Overlay Analysis**\n\n"
        "Overlay Layers Generated from Measured Pixels:\n"
        + "\n".join(f"• {name.replace('_', ' ').title()} overlay" for name in layer_names)
        + "\n\n"
        "Region Overlays:\n" + "\n".join(_spatial_lines(analysis)) + "\n\n"
        f"Coordinate Handling: {_georeferencing_text(analysis)}\n\n"
        f"Method: {analysis.get('method')}. Every overlay originates from this image's measured pixels; "
        "no synthetic detection coordinates are generated.\n\n"
        f"Limitations: {analysis.get('confidence_basis')}"
    )

    return _payload(
        "map_viewer",
        available=bool(layer_names),
        result=result,
        narrative=narrative,
        evidence=[
            f"Overlay layers: {', '.join(layer_names) if layer_names else AVAILABLE}",
            f"Method: {analysis.get('method')}",
            _georeferencing_text(analysis),
        ],
        method=analysis.get("method", ""),
        limitations=_method_limitations(analysis),
        key_findings=_spatial_lines(analysis),
        plan=plan,
    )


def _model_audit() -> Dict[str, Any]:
    try:
        from models.model_audit import verify_trained_models
    except ImportError:  # pragma: no cover - fallback when imported as a package
        try:
            from backend.python.models.model_audit import verify_trained_models
        except ImportError:
            return {"audited_models": [], "usable_models": [], "unavailable_models": [], "note": ""}
    return verify_trained_models()


def analyze_land_cover(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """Land-cover classification module (surface classes, not spectral indices)."""
    classes = analysis.get("class_percentages") or {}
    availability = analysis.get("class_availability") or {}
    supported = _available_class_names(analysis)
    dominant = _dominant_class(analysis)
    unsupported = [name for name in CLASS_ORDER if not availability.get(name)]

    distribution_lines = []
    for name in ("water", "vegetation", "built_up", "bare_land"):
        if availability.get(name):
            envelope = _region_envelope(analysis, name)
            regions = _region_summary(analysis, name) or {}
            distribution_lines.append(
                f"• {CLASS_LABELS[name]}: {_percent(classes.get(name))}"
                + (f", image-relative extent {envelope}" if envelope else "")
                + (
                    f", {regions['region_count']} distinct region(s)"
                    if regions.get("region_count")
                    else ""
                )
            )
        else:
            distribution_lines.append(
                f"• {CLASS_LABELS[name]}: {AVAILABLE} (no supporting image evidence)"
            )

    result = {
        "classes": {
            name: classes.get(name) if availability.get(name) else None for name in CLASS_ORDER
        },
        "supported_classes": supported,
        "unsupported_classes": unsupported,
        "dominant_class": dominant,
        "class_pixel_counts": analysis.get("class_pixel_counts"),
        "spatial_distribution": distribution_lines,
        "classification_framework_reference": "Corine Land Cover (CLC-19) referenced as a taxonomy only",
        "clc19_mapping_performed": False,
        "supervised_classifier_available": False,
    }

    dominant_text = (
        f"{CLASS_LABELS[dominant]} at {_percent(classes.get(dominant))}" if dominant else AVAILABLE
    )
    narrative = (
        "**Land Cover Classification**\n\n"
        "Detected Classes:\n"
        + "\n".join(
            f"- {CLASS_LABELS[name]}: "
            f"{_percent(classes.get(name)) if availability.get(name) else AVAILABLE}"
            for name in ("water", "vegetation", "built_up", "bare_land")
        )
        + "\n\n"
        f"Dominant Class: {dominant_text}\n\n"
        "Spatial Distribution:\n" + "\n".join(distribution_lines) + "\n\n"
        f"Method: {analysis.get('method')}. {analysis.get('confidence_basis')}\n\n"
        "Limitations: CLC-19 is shown as a reference framework only; no CLC-19 classifier mapping is "
        "performed on this image. "
        + (f"Classes not supported by this image's evidence: {', '.join(unsupported)}. " if unsupported else "")
        + "Class boundaries are threshold-based and are not validated against ground truth."
    )

    return _payload(
        "land_cover",
        available=bool(supported),
        result=result,
        narrative=narrative,
        evidence=[
            f"Method: {analysis.get('method')}",
            f"Supported classes: {', '.join(supported) if supported else AVAILABLE}",
            "CLC-19 taxonomy referenced only; no classifier mapping performed",
        ],
        method=analysis.get("method", ""),
        limitations=_method_limitations(analysis) + [
            "No supervised CLC-19 / BigEarthNet land-cover checkpoint is available for this pipeline."
        ],
        key_findings=[
            f"{CLASS_LABELS[name]}: {_percent(classes.get(name))}"
            for name in ("water", "vegetation", "built_up", "bare_land")
            if availability.get(name)
        ],
        plan=plan,
    )


def _region_objects(analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Genuinely measured class-region objects (not individual detections)."""
    objects = []
    classes = analysis.get("class_percentages") or {}
    for name in ("water", "vegetation", "built_up"):
        if not (analysis.get("class_availability") or {}).get(name):
            continue
        envelope = _region_envelope(analysis, name)
        if not envelope:
            continue
        regions = _region_summary(analysis, name) or {}
        objects.append({
            "class": name,
            "object_type": "class_region",
            "label": f"{CLASS_LABELS[name]} region",
            "location_image_relative": envelope,
            "coverage_percent": classes.get(name),
            "region_count": regions.get("region_count"),
            "bounding_box_normalized": (analysis.get("regions_image_relative") or {}).get(name),
        })
    return objects


def analyze_objects(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """Object detection module: measured regions plus an honest detector status."""
    audit = _model_audit()
    detector_available = any(
        entry.get("usable_for_claims") and entry.get("module") == "object_detection"
        for entry in audit.get("audited_models", [])
    )
    objects = _region_objects(analysis)

    result = {
        "objects": objects,
        "individual_object_detection_supported": False,
        "detector_available": detector_available,
        "detector": None if not detector_available else "trained object detector checkpoint",
        "region_level_only": True,
        "method": analysis.get("method"),
    }

    if objects:
        listing = "\n".join(
            f"{index}. {item['label']} — location {item['location_image_relative']}, "
            f"{_percent(item['coverage_percent'])} of the analyzed area, "
            f"{item['region_count'] if item['region_count'] is not None else AVAILABLE} distinct region(s)"
            for index, item in enumerate(objects, start=1)
        )
    else:
        listing = "No measurable class region could be delineated from this image."

    narrative = (
        "**Object Detection**\n\n"
        "Detected Region-Level Objects (measured from this image's pixels):\n"
        f"{listing}\n\n"
        "Detector Status: no trained object detector checkpoint is loadable for this pipeline, "
        "so individual buildings, vehicles or road segments are not counted and no per-object "
        "confidence is reported. The regions above are class-mask regions, not discrete instances.\n\n"
        f"Method: {analysis.get('method')}. {analysis.get('confidence_basis')}\n\n"
        "Limitations: object boundaries follow class-mask thresholds and the working analysis grid, "
        "so two adjacent objects of the same class cannot be separated here."
    )

    return _payload(
        "object_detection",
        available=bool(objects),
        result=result,
        narrative=narrative,
        evidence=[
            f"Region objects measured: {len(objects)}",
            f"Detector available: {'yes' if detector_available else 'no'}",
            f"Method: {analysis.get('method')}",
        ],
        method=analysis.get("method", ""),
        limitations=_method_limitations(analysis) + [
            "No trained object detector checkpoint is present; individual object counts are not provided."
        ],
        key_findings=[f"{item['label']}: {_percent(item['coverage_percent'])}" for item in objects],
        plan=plan,
    )


def analyze_sam_segmentation(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """SAM segmentation module: reports SAM status honestly before any claim."""
    audit = _model_audit()
    sam_candidates = [
        entry for entry in audit.get("audited_models", []) if entry.get("module") == "sam_segmentation"
    ]
    sam_ready = any(entry.get("usable_for_claims") for entry in sam_candidates)
    sam_status = sam_candidates[0]["status"] if sam_candidates else "NO_CHECKPOINT"

    objects = _region_objects(analysis) if not sam_ready else []
    result = {
        "sam_loaded_and_ran": False,
        "sam_status": sam_status,
        "sam_checkpoint_verified": sam_ready,
        "masks_generated_by_sam": [],
        "fallback_region_masks": [item["label"] for item in objects],
        "segmentation_source": "SAM" if sam_ready else "deterministic class masks",
    }

    narrative = (
        "**SAM Segmentation**\n\n"
        + (
            "SAM weights are loadable and segmentation output is reported from the segmenter."
            if sam_ready
            else f"SAM is not active for this image (audit status: '{sam_status}'), so no SAM mask "
            "was generated and this module does not claim SAM inference.\n\n"
            "Available segmentation instead: deterministic class masks measured from this image — "
            + (", ".join(item["label"] for item in objects) if objects else "none could be delineated")
            + "."
        )
        + f"\n\nMethod: {analysis.get('method')}. Region envelopes are image-relative.\n\n"
        f"Limitations: {analysis.get('confidence_basis')}"
    )

    return _payload(
        "sam_segmentation",
        available=True,
        result=result,
        narrative=narrative,
        evidence=[
            f"SAM status: {sam_status}",
            f"Fallback region masks: {len(objects)}",
            f"Method: {analysis.get('method')}",
        ],
        method=analysis.get("method", ""),
        limitations=_method_limitations(analysis) + [
            "SAM inference was not executed; only deterministic class masks are available."
        ],
        key_findings=[f"SAM status: {sam_status}"],
        plan=plan,
    )


def analyze_disaster(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    secondary_analysis: Optional[Dict[str, Any]] = None,
    coverage_deltas: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """Disaster-oriented screening: hazard evidence, never a confirmed event."""
    classes = analysis.get("class_percentages") or {}
    availability = analysis.get("class_availability") or {}
    water_available = bool(availability.get("water"))
    water_pct = classes.get("water") if water_available else None
    water_regions = _region_summary(analysis, "water") or {}
    water_index_name = analysis.get("water_index")
    has_second = secondary_analysis is not None
    delta_water = (coverage_deltas or {}).get("water") if has_second else None

    result = {
        "module": "disaster",
        "flood_evidence": {
            "water_coverage_percent": water_pct,
            "water_region_count": water_regions.get("region_count"),
            "water_concentration_percent_of_water_mask": water_regions.get(
                "largest_region_share_percent"
            ),
            "water_index_used": water_index_name,
            "temporal_comparison_available": has_second,
            "water_coverage_change_percentage_points": delta_water,
            "flood_confirmed": False,
        },
        "fire_evidence": {
            "burn_scar_detector_available": False,
            "spectral_burn_indicator_available": False,
            "active_fire_confirmed": False,
        },
        "confirmed_disaster": None,
    }

    if water_available:
        flood_text = (
            f"Water-covered surface measures {_percent(water_pct)} of the analyzed area across "
            f"{water_regions.get('region_count', 0)} region(s); the largest water region covers "
            f"{_percent(water_regions.get('largest_region_share_percent'))} of the water mask "
            f"({water_index_name or 'RGB water estimate'}). "
        )
        if has_second:
            flood_text += (
                f"Reported water coverage change between the two images: "
                f"{delta_water if delta_water is not None else AVAILABLE} percentage points. "
            )
        else:
            flood_text += "Only one image was supplied, so temporal water expansion cannot be measured. "
        flood_text += (
            "Water-covered regions were detected, but flood confirmation requires temporal or "
            "contextual evidence; a single image cannot confirm flooding."
        )
    else:
        flood_text = (
            "Flood indicators cannot be evaluated because water coverage is not measurable from "
            "this image's available evidence."
        )

    result["flood_evidence"]["water_available"] = water_available

    narrative = (
        "**Disaster Analysis**\n\n"
        f"Flood Screening: {flood_text}\n\n"
        "Fire Screening: no validated burn-scar / active-fire detector is available in this "
        "pipeline and no burn index is computed, so no fire claim is made for this image.\n\n"
        f"Other Measured Surface Context:\n" + "\n".join(_class_lines(analysis)) + "\n\n"
        f"Method: {analysis.get('method')}. {analysis.get('confidence_basis')}\n\n"
        "Limitations: hazard indicators above are measured surface evidence only. They are not a "
        "confirmed disaster declaration and must be cross-checked with temporal imagery or "
        "authoritative event reports."
    )

    return _payload(
        "disaster",
        available=True,
        result=result,
        narrative=narrative,
        evidence=[
            f"Water coverage: {_percent(water_pct)}",
            f"Water index used: {water_index_name or 'RGB water estimate'}",
            f"Temporal comparison available: {'yes' if has_second else 'no'}",
        ],
        method=analysis.get("method", ""),
        limitations=_method_limitations(analysis) + [
            "Water detected is not flood confirmation.",
            "No validated burn-scar or active-fire detector is available in this pipeline.",
        ],
        key_findings=[
            f"Water coverage: {_percent(water_pct)}",
            "Flood confirmed: no (requires temporal or contextual evidence)",
            "Active fire confirmed: no (no validated fire evidence)",
        ],
        plan=plan,
    )


def analyze_agriculture(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    secondary_analysis: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """Agriculture-specific analysis: field/vegetation/soil/irrigation indicators."""
    classes = analysis.get("class_percentages") or {}
    availability = analysis.get("class_availability") or {}
    vegetation_available = bool(availability.get("vegetation"))
    vegetation_pct = classes.get("vegetation") if vegetation_available else None
    bare_pct = classes.get("bare_land") if availability.get("bare_land") else None
    water_pct = classes.get("water") if availability.get("water") else None
    ndvi = _index_block(analysis, "ndvi")
    veg_regions = _region_summary(analysis, "vegetation") or {}

    if vegetation_available and veg_regions.get("region_count") is not None:
        field_pattern = (
            f"vegetation resolves into {veg_regions['region_count']} distinct region(s); the largest "
            f"region holds {_percent(veg_regions.get('largest_region_share_percent'))} of the vegetation "
            "mask, which is a parcel-fragmentation indicator rather than a field boundary map"
        )
    else:
        field_pattern = AVAILABLE

    if ndvi:
        health = ndvi.get("health_interpretation", AVAILABLE)
    elif vegetation_available:
        health = (
            "true NDVI is unavailable (no mapped Red and NIR bands), so health is limited to the "
            "measured green-canopy coverage estimate"
        )
    else:
        health = AVAILABLE

    result = {
        "agricultural_region_estimate_percent": vegetation_pct,
        "agricultural_region_basis": "upper bound from measured vegetation-like cover; not a crop map",
        "vegetation_coverage_percent": vegetation_pct,
        "vegetation_health": health,
        "field_pattern_indicator": field_pattern,
        "water_irrigation_indicators": {
            "water_coverage_percent": water_pct,
            "water_index_used": analysis.get("water_index"),
            "note": "surface water presence near fields is an irrigation indicator only",
        },
        "bare_soil_percent": bare_pct,
        "ndvi": {
            "available": bool(ndvi),
            "mean": ndvi.get("mean") if ndvi else None,
            "min": ndvi.get("minimum") if ndvi else None,
            "max": ndvi.get("maximum") if ndvi else None,
            "vegetation_coverage_from_ndvi_percent": analysis.get("vegetation_percentage")
            if ndvi
            else None,
        },
        "crop_type_classification_supported": False,
        "temporal_comparison_available": secondary_analysis is not None,
    }

    narrative = (
        "**Agriculture Analysis**\n\n"
        f"Agricultural Regions: {_percent(vegetation_pct)} "
        "(upper-bound estimate from measured vegetation-like cover; this is not a crop-area map)\n\n"
        f"Vegetation Coverage: {_percent(vegetation_pct)}\n\n"
        f"Vegetation Health: {health}\n\n"
        f"Field Pattern: {field_pattern}\n\n"
        f"Water/Irrigation Indicators: water coverage {_percent(water_pct)} "
        f"({analysis.get('water_index') or 'RGB water estimate'}); bare soil {_percent(bare_pct)}\n\n"
        f"NDVI: {_number(ndvi['mean']) if ndvi else AVAILABLE} "
        + ("(measured from mapped Red and NIR bands)" if ndvi else "(mapped Red and NIR bands unavailable)")
        + "\n\n"
        "Interpretation: "
        + (
            f"the scene contains {_percent(vegetation_pct)} vegetation-like surface, consistent with "
            "cultivated or vegetated land; no crop type, yield or growth stage can be identified "
            "because no crop classifier is available."
            if vegetation_available
            else "vegetation cover is not measurable from this image's evidence, so agricultural "
            "interpretation is not supported."
        )
        + f"\n\nMethod: {analysis.get('method')}. {_acquisition_text(image_metadata, analysis)}\n\n"
        f"Limitations: {analysis.get('confidence_basis')} Crop-specific identification requires a "
        "trained crop classifier and multi-date imagery, which this pipeline does not have."
    )

    return _payload(
        "agriculture",
        available=vegetation_available,
        result=result,
        narrative=narrative,
        evidence=[
            f"Vegetation coverage: {_percent(vegetation_pct)}",
            f"NDVI: {_number(ndvi['mean']) if ndvi else AVAILABLE}",
            f"Method: {analysis.get('method')}",
        ],
        method=analysis.get("method", ""),
        limitations=_method_limitations(analysis) + [
            "No crop-type classifier is available; only vegetation, soil and water indicators are measured."
        ],
        key_findings=[
            f"Vegetation coverage: {_percent(vegetation_pct)}",
            f"Bare soil: {_percent(bare_pct)}",
            f"Water/irrigation indicator: {_percent(water_pct)}",
            f"NDVI: {_number(ndvi['mean']) if ndvi else AVAILABLE}",
        ],
        plan=plan,
    )


def analyze_ndvi_health(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """NDVI Health module: vegetation condition from measured NDVI (or an honest RGB fallback)."""
    ndvi = _index_block(analysis, "ndvi")
    vegetation_pct = analysis.get("vegetation_percentage")
    veg_regions = _region_summary(analysis, "vegetation") or {}

    if ndvi:
        health = ndvi.get("health_interpretation", AVAILABLE)
        result = {
            "ndvi_available": True,
            "mean_ndvi": ndvi.get("mean"),
            "median_ndvi": ndvi.get("median"),
            "minimum_ndvi": ndvi.get("minimum"),
            "maximum_ndvi": ndvi.get("maximum"),
            "formula": ndvi.get("formula"),
            "vegetation_cover_percent": vegetation_pct,
            "health_interpretation": health,
            "density_classes_returned": False,
        }
        narrative = (
            "**NDVI Health (Vegetation Condition)**\n\n"
            f"{_index_stats(analysis, 'ndvi')}\n\n"
            f"Vegetation Coverage (NDVI > 0.2 mask): {_percent(vegetation_pct)} "
            f"across {veg_regions.get('region_count', 0)} distinct region(s).\n\n"
            f"Vegetation Health Interpretation: {health}.\n\n"
            "Spatial Distribution: "
            + (_region_envelope(analysis, "vegetation") or "no vegetation pixels were measured")
            + "\n\n"
            "Note: dense/moderate/sparse per-pixel density classes are not returned by this pipeline; "
            "the interpretation is based on the measured NDVI distribution above.\n\n"
            f"Method: {analysis.get('method')}\n\n"
            f"Limitations: {analysis.get('confidence_basis')}"
        )
        available = True
    else:
        result = {
            "ndvi_available": False,
            "reason": "NIR band unavailable in the uploaded image",
            "vegetation_cover_percent": vegetation_pct,
            "rgb_vegetation_estimation_available": vegetation_pct is not None,
        }
        if analysis.get("image_type") == "rgb":
            limitation = "True NDVI is unavailable because NIR is not present."
        else:
            limitation = (
                "True NDVI is unavailable because the image's mapped bands do not include "
                "Red and NIR together."
            )
        narrative = (
            "**NDVI Health (Vegetation Condition)**\n\n"
            f"{limitation} "
            + (
                f"RGB-based vegetation estimation is available: measured vegetation-like cover is "
                f"{_percent(vegetation_pct)} across {veg_regions.get('region_count', 0)} distinct region(s), "
                f"with image-relative extent {_region_envelope(analysis, 'vegetation') or AVAILABLE}."
                if vegetation_pct is not None
                else "No vegetation-like coverage could be estimated either."
            )
            + "\n\nBecause no near-infrared band is mapped, no NDVI mean, minimum or maximum is reported.\n\n"
            f"Method: {analysis.get('method')}\n\n"
            f"Limitations: {analysis.get('confidence_basis')}"
        )
        available = vegetation_pct is not None

    return _payload(
        "ndvi_health",
        available=available,
        result=result,
        narrative=narrative,
        evidence=[
            f"NDVI available: {'yes' if ndvi else 'no'}",
            f"Vegetation cover: {_percent(vegetation_pct)}",
            f"Method: {analysis.get('method')}",
        ],
        method=analysis.get("method", ""),
        limitations=_method_limitations(analysis) + (
            [] if ndvi else ["NDVI requires mapped Red and NIR bands, which this upload does not provide."]
        ),
        key_findings=[
            f"Mean NDVI: {_number(ndvi['mean']) if ndvi else AVAILABLE}",
            f"Vegetation cover: {_percent(vegetation_pct)}",
        ],
        plan=plan,
    )


def analyze_urban_growth(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    secondary_analysis: Optional[Dict[str, Any]] = None,
    coverage_deltas: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """Urban growth module: current built-up analysis, growth only with two dates."""
    classes = analysis.get("class_percentages") or {}
    built_available = bool((analysis.get("class_availability") or {}).get("built_up"))
    built_pct = classes.get("built_up") if built_available else None
    built_regions = _region_summary(analysis, "built_up") or {}
    ndbi_block = (analysis.get("indices") or {}).get("ndbi")
    deltas = coverage_deltas or {}
    built_delta = deltas.get("built_up") if secondary_analysis is not None else None

    result = {
        "current_built_up_percent": built_pct,
        "built_up_region_count": built_regions.get("region_count"),
        "built_up_largest_region_percent": built_regions.get("largest_region_share_percent"),
        "built_up_extent": _region_envelope(analysis, "built_up"),
        "ndbi_index": ndbi_block.get("mean") if ndbi_block else None,
        "temporal_comparison_available": secondary_analysis is not None,
        "built_up_change_percentage_points": built_delta,
        "growth_confirmed": bool(built_delta is not None and built_delta > 0),
    }

    secondary_built = (secondary_analysis or {}).get("class_percentages", {}).get("built_up")
    if secondary_analysis is not None:
        if built_delta is None:
            change_text = (
                "Built-up coverage could not be compared because coverage was not measurable in both "
                "images on the same analysis basis."
            )
        elif built_delta > 0:
            change_text = (
                f"Built-up coverage increased by {built_delta:+.2f} percentage points between the two "
                f"images (image A {_percent(built_pct)} → image B {_percent(secondary_built)})."
            )
        elif built_delta < 0:
            change_text = (
                f"Built-up coverage decreased by {built_delta:+.2f} percentage points between the two "
                "images."
            )
        else:
            change_text = "Built-up coverage was unchanged between the two images at this precision."
    else:
        change_text = (
            "Urban growth requires comparison with imagery from another time period; only one image "
            "was supplied, so growth cannot be measured and is not claimed."
        )

    region_text = (
        f" ({built_regions.get('region_count')} distinct region(s), largest region "
        f"{_percent(built_regions.get('largest_region_share_percent'))} of the built-up mask)"
        if built_regions.get("region_count")
        else ""
    )
    narrative = (
        "**Current Built-up Analysis**\n\n"
        f"Built-up coverage: {_percent(built_pct)} of the analyzed area{region_text}. "
        f"Image-relative extent: {_region_envelope(analysis, 'built_up') or AVAILABLE}\n\n"
        f"Temporal Change: {change_text}\n\n"
        f"Method: {analysis.get('method')}. {analysis.get('confidence_basis')}\n\n"
        "Limitations: built-up coverage is a threshold mask, not a building census. Only the "
        "difference in image-wide coverage is measured; no co-registered pixel-aligned conversion "
        "map is produced."
    )

    return _payload(
        "urban_growth",
        available=built_available,
        result=result,
        narrative=narrative,
        evidence=[
            f"Built-up coverage: {_percent(built_pct)}",
            f"Temporal comparison available: {'yes' if secondary_analysis is not None else 'no'}",
            f"Method: {analysis.get('method')}",
        ],
        method=analysis.get("method", ""),
        limitations=_method_limitations(analysis) + [
            "Urban growth is a temporal claim and requires imagery from at least two time periods."
        ],
        key_findings=[
            f"Built-up coverage: {_percent(built_pct)}",
            change_text,
        ],
        plan=plan,
    )


def analyze_ndbi(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """NDBI module: built-up index statistics. The band limitation belongs only here."""
    ndbi = _index_block(analysis, "ndbi")
    availability = analysis.get("class_availability") or {}
    built_pct = (
        (analysis.get("class_percentages") or {}).get("built_up") if availability.get("built_up") else None
    )
    built_regions = _region_summary(analysis, "built_up") or {}
    band_status = module_band_status("ndbi", analysis)

    if ndbi:
        narrative = (
            "**NDBI Built-up Index Analysis**\n\n"
            f"{_index_stats(analysis, 'ndbi')}\n\n"
            f"Built-up Coverage from the NDBI threshold mask: {_percent(built_pct)} "
            f"({built_regions.get('region_count', 0)} distinct region(s)).\n\n"
            f"Spatial Distribution: {_region_envelope(analysis, 'built_up') or 'no built-up pixels measured'}\n\n"
            "Interpretation: positive NDBI means stronger short-wave infrared response than "
            "near-infrared, which is characteristic of impervious/built surfaces.\n\n"
            f"Method: {analysis.get('method')}\n\n"
            f"Limitations: {analysis.get('confidence_basis')}"
        )
    else:
        missing = band_status["per_index"].get("ndbi", {})
        required_text = ", ".join(band.upper() for band in missing.get("required_bands", ["swir", "nir"]))
        missing_text = ", ".join(band.upper() for band in missing.get("missing_bands", []))
        narrative = (
            "**NDBI Built-up Index Analysis**\n\n"
            f"NDBI cannot be calculated from the available bands: NDBI requires the {required_text} bands"
            + (f", and {missing_text} is not present in this upload." if missing_text else ".")
            + f"\n\nMeasured alternative from this image: built-up-like coverage {_percent(built_pct)} "
            "(deterministic class mask, not an NDBI value).\n\n"
            f"Method: {analysis.get('method')}\n\n"
            f"Limitations: {analysis.get('confidence_basis')}"
        )

    return _payload(
        "ndbi",
        available=bool(ndbi) or built_pct is not None,
        result={
            "ndbi_available": bool(ndbi),
            "mean_ndbi": ndbi.get("mean") if ndbi else None,
            "minimum_ndbi": ndbi.get("minimum") if ndbi else None,
            "maximum_ndbi": ndbi.get("maximum") if ndbi else None,
            "formula": ndbi.get("formula") if ndbi else "(SWIR - NIR) / (SWIR + NIR)",
            "required_bands": band_status["required_bands"],
            "available_bands": band_status["available_bands"],
            "missing_bands": band_status["missing_bands"],
            "built_up_coverage_percent": built_pct,
            "fallback_measured": not ndbi,
            "trained_built_up_model_available": False,
        },
        narrative=narrative,
        evidence=[
            f"NDBI available: {'yes' if ndbi else 'no'}",
            f"Required bands: {', '.join(band.upper() for band in band_status['required_bands'])}",
            f"Built-up coverage from class mask: {_percent(built_pct)}",
        ],
        method=analysis.get("method", ""),
        limitations=_method_limitations(analysis)
        + ([] if ndbi else ["NDBI requires mapped SWIR and NIR bands."]),
        key_findings=[
            f"Mean NDBI: {_number(ndbi['mean']) if ndbi else AVAILABLE}",
            f"Built-up coverage: {_percent(built_pct)}",
        ],
        plan=plan,
    )


def _water_vegetation_values(analysis: Dict[str, Any]) -> Dict[str, Any]:
    availability = analysis.get("class_availability") or {}
    classes = analysis.get("class_percentages") or {}
    return {
        "water_available": bool(availability.get("water")),
        "water_percent": classes.get("water") if availability.get("water") else None,
        "vegetation_available": bool(availability.get("vegetation")),
        "vegetation_percent": classes.get("vegetation") if availability.get("vegetation") else None,
        "water_index": analysis.get("water_index"),
        "ndvi": _index_block(analysis, "ndvi"),
    }


def analyze_water_vegetation(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """Water & Vegetation module: compare measured water and vegetation coverage."""
    values = _water_vegetation_values(analysis)
    water_pct = values["water_percent"]
    vegetation_pct = values["vegetation_percent"]
    water_regions = _region_summary(analysis, "water") or {}
    veg_regions = _region_summary(analysis, "vegetation") or {}

    if water_pct is not None and vegetation_pct is not None:
        if water_pct > vegetation_pct:
            dominance = (
                f"Water-dominant scene (water {_percent(water_pct)} vs "
                f"vegetation {_percent(vegetation_pct)})"
            )
        elif vegetation_pct > water_pct:
            dominance = (
                f"Vegetation-dominant scene (vegetation {_percent(vegetation_pct)} vs "
                f"water {_percent(water_pct)})"
            )
        else:
            dominance = f"Water and vegetation are balanced at {_percent(water_pct)} each"
    else:
        dominance = "Dominance cannot be established because one of the two coverages is unavailable"

    water_extent = _region_envelope(analysis, "water")
    veg_extent = _region_envelope(analysis, "vegetation")
    if water_extent and veg_extent:
        spatial_relationship = (
            f"water occupies {water_extent} while vegetation occupies {veg_extent}; both are "
            "image-relative envelopes from separate class masks"
        )
    else:
        spatial_relationship = "no reliable spatial relationship is reported (an envelope is unavailable)"

    spectral_evidence = (
        f"water index {values['water_index']}"
        if values["water_index"]
        else "no spectral water index is available (RGB colour estimate only)"
    )
    if values["ndvi"]:
        spectral_evidence += f"; NDVI mean {_number(values['ndvi']['mean'])}"
    else:
        spectral_evidence += "; NDVI unavailable (no mapped Red and NIR bands)"

    result = {
        "water_coverage_percent": water_pct,
        "vegetation_coverage_percent": vegetation_pct,
        "water_dominant": (water_pct > vegetation_pct)
        if (water_pct is not None and vegetation_pct is not None)
        else None,
        "vegetation_dominant": (vegetation_pct > water_pct)
        if (water_pct is not None and vegetation_pct is not None)
        else None,
        "water_regions": water_regions,
        "vegetation_regions": veg_regions,
        "spectral_evidence": spectral_evidence,
    }

    narrative = (
        "**Water & Vegetation Analysis**\n\n"
        f"Water Coverage: {_percent(water_pct)}\n\n"
        f"Vegetation Coverage: {_percent(vegetation_pct)}\n\n"
        f"Dominance: {dominance}\n\n"
        f"Spatial Relationship: {spatial_relationship}\n\n"
        f"Spectral Evidence: {spectral_evidence}\n\n"
        f"Method: {analysis.get('method')}. {analysis.get('confidence_basis')}\n\n"
        "Limitations: both coverages are surface-extent estimates from this image, not water depth "
        "or vegetation biomass. Water index and NDVI are used only when their bands genuinely exist."
    )

    return _payload(
        "water_vegetation",
        available=water_pct is not None or vegetation_pct is not None,
        result=result,
        narrative=narrative,
        evidence=[
            f"Water coverage: {_percent(water_pct)}",
            f"Vegetation coverage: {_percent(vegetation_pct)}",
            f"Spectral evidence: {spectral_evidence}",
        ],
        method=analysis.get("method", ""),
        limitations=_method_limitations(analysis),
        key_findings=[
            f"Water: {_percent(water_pct)}",
            f"Vegetation: {_percent(vegetation_pct)}",
            dominance,
        ],
        plan=plan,
    )


def analyze_water_analysis(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """Water-only analysis module."""
    values = _water_vegetation_values(analysis)
    water_pct = values["water_percent"]
    water_regions = _region_summary(analysis, "water") or {}
    detected = (water_pct or 0) > 0
    index_note = (
        f"Measured with {values['water_index']}"
        if values["water_index"]
        else "Measured with an RGB colour-based water estimate because no spectral water index is available"
    )

    narrative = (
        "**Water Analysis**\n\n"
        + (
            f"Water was detected in approximately {_percent(water_pct)} of the analyzed area across "
            f"{water_regions.get('region_count', 0)} distinct region(s) with image-relative extent "
            f"{_region_envelope(analysis, 'water') or AVAILABLE}."
            if water_pct is not None
            else "Water coverage is not measurable from this image's available evidence."
        )
        + "\n\n"
        + (
            f"{'Yes' if detected else 'No'} — measured water-like coverage is "
            f"{'present' if detected else 'absent'} at the analyzed resolution.\n\n"
        )
        + f"Evidence: {index_note}. The largest water region holds "
        f"{_percent(water_regions.get('largest_region_share_percent'))} of the water mask.\n\n"
        "Interpretation: this value represents estimated surface coverage, not water depth or volume. "
        "Water detection alone cannot confirm flooding; confirmation requires temporal or contextual "
        "evidence.\n\n"
        f"Method: {analysis.get('method')}. {analysis.get('confidence_basis')}"
    )

    return _payload(
        "water_analysis",
        available=water_pct is not None,
        result={
            "water_detected": detected if water_pct is not None else None,
            "coverage_percentage": water_pct,
            "regions": water_regions.get("region_count"),
            "largest_region_percent_of_water_mask": water_regions.get("largest_region_share_percent"),
            "extent_image_relative": _region_envelope(analysis, "water"),
            "index_used": values["water_index"],
        },
        narrative=narrative,
        evidence=[
            f"Water coverage: {_percent(water_pct)}",
            f"Index used: {values['water_index'] or 'RGB colour estimate'}",
            f"Method: {analysis.get('method')}",
        ],
        method=analysis.get("method", ""),
        limitations=_method_limitations(analysis) + [
            "Surface coverage is not water depth; flood confirmation requires temporal evidence."
        ],
        key_findings=[
            f"Water coverage: {_percent(water_pct)}",
            f"Water detected: {'yes' if detected and water_pct is not None else 'no'}",
        ],
        plan=plan,
    )


def analyze_vegetation_analysis(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """Vegetation-only analysis module."""
    values = _water_vegetation_values(analysis)
    vegetation_pct = values["vegetation_percent"]
    veg_regions = _region_summary(analysis, "vegetation") or {}
    ndvi = values["ndvi"]

    narrative = (
        "**Vegetation Analysis**\n\n"
        + (
            f"Vegetation-like surface occupies approximately {_percent(vegetation_pct)} of the analyzed "
            f"area across {veg_regions.get('region_count', 0)} distinct region(s), with image-relative "
            f"extent {_region_envelope(analysis, 'vegetation') or AVAILABLE}."
            if vegetation_pct is not None
            else "Vegetation coverage is not measurable from this image's available evidence."
        )
        + "\n\n"
        + (
            f"Measured vigour: {_index_stats(analysis, 'ndvi')} "
            f"({ndvi.get('health_interpretation', AVAILABLE)})."
            if ndvi
            else "No NDVI is available for this upload (mapped Red and NIR bands are required), so only "
            "colour-based vegetation coverage is reported."
        )
        + f"\n\nMethod: {analysis.get('method')}. {analysis.get('confidence_basis')}\n\n"
        "Limitations: this is extent, not biomass, canopy height or species composition. Forest "
        "classification requires a trained land-cover model, which is not available here."
    )

    return _payload(
        "vegetation_analysis",
        available=vegetation_pct is not None,
        result={
            "vegetation_coverage_percent": vegetation_pct,
            "regions": veg_regions.get("region_count"),
            "largest_region_percent_of_vegetation_mask": veg_regions.get("largest_region_share_percent"),
            "extent_image_relative": _region_envelope(analysis, "vegetation"),
            "ndvi_available": bool(ndvi),
            "mean_ndvi": ndvi.get("mean") if ndvi else None,
            "health_interpretation": ndvi.get("health_interpretation") if ndvi else None,
        },
        narrative=narrative,
        evidence=[
            f"Vegetation coverage: {_percent(vegetation_pct)}",
            f"NDVI: {_number(ndvi['mean']) if ndvi else AVAILABLE}",
            f"Method: {analysis.get('method')}",
        ],
        method=analysis.get("method", ""),
        limitations=_method_limitations(analysis),
        key_findings=[
            f"Vegetation coverage: {_percent(vegetation_pct)}",
            f"Mean NDVI: {_number(ndvi['mean']) if ndvi else AVAILABLE}",
        ],
        plan=plan,
    )


def analyze_urban_analysis(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """Built-up coverage module (single date)."""
    classes = analysis.get("class_percentages") or {}
    availability = analysis.get("class_availability") or {}
    built_pct = classes.get("built_up") if availability.get("built_up") else None
    built_regions = _region_summary(analysis, "built_up") or {}
    ndbi = _index_block(analysis, "ndbi")

    narrative = (
        "**Built-up Coverage Analysis**\n\n"
        + (
            f"Built-up-like surface covers approximately {_percent(built_pct)} of the analyzed area "
            f"across {built_regions.get('region_count', 0)} distinct region(s), with image-relative "
            f"extent {_region_envelope(analysis, 'built_up') or AVAILABLE}."
            if built_pct is not None
            else "Built-up coverage is not measurable from this image's available evidence."
        )
        + "\n\n"
        + (
            f"Spectral support: {_index_stats(analysis, 'ndbi')}."
            if ndbi
            else "No NDBI is available for this upload, so built-up coverage is taken from the class mask."
        )
        + f"\n\nMethod: {analysis.get('method')}. {analysis.get('confidence_basis')}\n\n"
        "Limitations: this is a coverage estimate, not a building count. Urban expansion over time "
        "requires imagery from at least two time periods."
    )

    return _payload(
        "urban_analysis",
        available=built_pct is not None,
        result={
            "built_up_coverage_percent": built_pct,
            "regions": built_regions.get("region_count"),
            "largest_region_percent_of_built_up_mask": built_regions.get("largest_region_share_percent"),
            "extent_image_relative": _region_envelope(analysis, "built_up"),
            "ndbi_available": bool(ndbi),
            "mean_ndbi": ndbi.get("mean") if ndbi else None,
        },
        narrative=narrative,
        evidence=[
            f"Built-up coverage: {_percent(built_pct)}",
            f"NDBI: {_number(ndbi['mean']) if ndbi else AVAILABLE}",
            f"Method: {analysis.get('method')}",
        ],
        method=analysis.get("method", ""),
        limitations=_method_limitations(analysis),
        key_findings=[f"Built-up coverage: {_percent(built_pct)}"],
        plan=plan,
    )


def analyze_spectral_indices(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """Spectral-index module (NDVI / NDWI / MNDWI / NDBI). Band limits are reported here only."""
    indices = analysis.get("indices") or {}
    band_status = module_band_status("spectral_indices", analysis)
    classes = analysis.get("class_percentages") or {}
    availability = analysis.get("class_availability") or {}
    ndbi_block = indices.get("ndbi")

    blocks = []
    result_indices: Dict[str, Any] = {}
    for name in ("ndvi", "ndwi", "mndwi", "ndbi"):
        block = indices.get(name)
        status = band_status["per_index"].get(name, {})
        if block:
            blocks.append(_index_stats(analysis, name))
            result_indices[name] = {
                "available": True,
                "mean": block.get("mean"),
                "median": block.get("median"),
                "minimum": block.get("minimum"),
                "maximum": block.get("maximum"),
                "formula": block.get("formula"),
            }
            continue
        required = ", ".join(band.upper() for band in status.get("required_bands", []))
        missing = ", ".join(band.upper() for band in status.get("missing_bands", []))
        if name == "ndwi" and band_status["per_index"].get("mndwi", {}).get("available"):
            blocks.append(
                "NDWI: unavailable — mapped Green and NIR bands are required; "
                "MNDWI is measured instead (Green and SWIR)."
            )
        else:
            blocks.append(
                f"{name.upper()}: unavailable — requires the {required} bands"
                + (f"; {missing} is not present in this upload" if missing else "")
                + "."
            )
        result_indices[name] = {
            "available": False,
            "reason": f"{required} bands unavailable",
            "missing_bands": status.get("missing_bands", []),
        }

    limitation = _plan_limitation(plan)
    water_pct = classes.get("water") if availability.get("water") else None
    veg_pct = analysis.get("vegetation_percentage")
    built_pct = classes.get("built_up") if availability.get("built_up") else None

    narrative = (
        "**Spectral Index Analysis (NDVI / NDWI / MNDWI / NDBI)**\n\n"
        + "\n".join(blocks)
        + "\n\n"
        f"Threshold Masks Derived from Available Indices: water {_percent(water_pct)}, "
        f"vegetation {_percent(veg_pct)}, built-up {_percent(built_pct)} "
        f"({analysis.get('water_index') or 'no spectral water index'} used for the water mask).\n\n"
        + (f"Band Limitation: {limitation}\n\n" if limitation else "")
        + "Interpretation: these are measured reflectance ratios, not land-cover classes; land-cover "
        "determination is a separate module.\n\n"
        f"Method: {analysis.get('method')}. Available mapped bands: "
        f"{', '.join(band.upper() for band in band_status['available_bands']) or 'none'}.\n\n"
        f"Limitations: {analysis.get('confidence_basis')}"
    )

    return _payload(
        "spectral_indices",
        available=any(item.get("available") for item in result_indices.values()),
        result={
            "indices": result_indices,
            "available_bands": band_status["available_bands"],
            "index_band_status": band_status["per_index"],
            "band_limitation": limitation,
            "water_index_used": analysis.get("water_index"),
            "threshold_masks": {
                "water_percent": water_pct,
                "vegetation_percent": veg_pct,
                "built_up_percent": built_pct,
                "ndbi_mean": ndbi_block.get("mean") if ndbi_block else None,
            },
        },
        narrative=narrative,
        evidence=[
            f"Available mapped bands: "
            f"{', '.join(band.upper() for band in band_status['available_bands']) or 'none'}",
            f"NDVI available: {'yes' if indices.get('ndvi') else 'no'}",
            f"Water index used: {analysis.get('water_index') or AVAILABLE}",
        ],
        method=analysis.get("method", ""),
        limitations=_method_limitations(analysis) + ([limitation] if limitation else []),
        key_findings=blocks,
        plan=plan,
    )


def analyze_change_detection(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    secondary_analysis: Optional[Dict[str, Any]] = None,
    coverage_deltas: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """Bi-temporal module: needs two dates; never pretends one image has temporal change."""
    if secondary_analysis is None:
        narrative = (
            "**Bi-Temporal Change Analysis**\n\n"
            "Bi-temporal change analysis requires imagery from at least two time periods. Only one "
            "image was supplied, so no change could be measured and no change is claimed.\n\n"
            "Single-image measurements available for reference:\n"
            + "\n".join(_class_lines(analysis))
            + f"\n\nMethod: {analysis.get('method')}\n\n"
            "Next step: add a second acquisition of the same area, ideally co-registered, to compare "
            "water, vegetation, built-up and bare-land coverage."
        )
        return _payload(
            "change_detection",
            available=False,
            result={
                "requires_second_image": True,
                "second_image_available": False,
                "change_measured": False,
                "current_measurements": {
                    name: (analysis.get("class_percentages") or {}).get(name)
                    if (analysis.get("class_availability") or {}).get(name)
                    else None
                    for name in CLASS_ORDER
                },
            },
            narrative=narrative,
            evidence=[
                "Second image not supplied",
                f"Current coverage measured on {analysis.get('valid_pixel_count')} valid pixels",
            ],
            method=analysis.get("method", ""),
            limitations=["Change detection requires two comparable acquisitions."],
            key_findings=["Bi-temporal change analysis requires imagery from at least two time periods."],
            plan=plan,
        )

    deltas = coverage_deltas or {}
    comparable = bool(deltas)
    rows = []
    for name in ("water", "vegetation", "built_up", "bare_land", "other"):
        delta = deltas.get(name)
        rows.append(
            f"- {CLASS_LABELS[name]}: "
            + (f"{delta:+.2f} percentage points" if delta is not None else AVAILABLE)
        )
    narrative = (
        "**Bi-Temporal Change Analysis**\n\n"
        + (
            "Measured coverage change (image B minus image A):\n" + "\n".join(rows)
            if comparable
            else "The two images were not comparable on the same analysis basis, so no coverage "
            "difference is reported."
        )
        + "\n\nInterpretation: these are image-wide coverage differences, not a pixel-aligned change "
        "map; spatial change requires co-registration.\n\n"
        f"Method: image A {analysis.get('method')}; image B {secondary_analysis.get('method')}.\n\n"
        "Limitations: no co-registration or footprint equivalence is asserted between the two inputs. "
        "Change values describe whole-image coverage, not converted land parcels."
    )

    return _payload(
        "change_detection",
        available=comparable,
        result={
            "requires_second_image": True,
            "second_image_available": True,
            "change_measured": comparable,
            "coverage_change_percentage_points": deltas,
            "image_b_class_percentages": secondary_analysis.get("class_percentages"),
            "pixel_aligned_change_map": False,
        },
        narrative=narrative,
        evidence=[
            f"Image A basis: {analysis.get('image_type')} / {analysis.get('method')}",
            f"Image B basis: {secondary_analysis.get('image_type')} / {secondary_analysis.get('method')}",
            f"Comparable coverage basis: {'yes' if comparable else 'no'}",
        ],
        method=f"A: {analysis.get('method')} | B: {secondary_analysis.get('method')}",
        limitations=[
            "Coverage differences are not a pixel-aligned change map.",
            "No co-registration was verified between the two images.",
        ],
        key_findings=[row.lstrip("- ") for row in rows] if comparable else [],
        plan=plan,
    )


def analyze_vlm(
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    **_: Any,
) -> Dict[str, Any]:
    """VLM interpretation module: explains measured values, never invents numbers."""
    audit = _model_audit()
    trained_vlm = any(
        entry.get("usable_for_claims") and entry.get("module") == "vlm"
        for entry in audit.get("audited_models", [])
    )
    classes = analysis.get("class_percentages") or {}
    availability = analysis.get("class_availability") or {}
    dominant = _dominant_class(analysis)
    measured = {
        name: classes.get(name) if availability.get(name) else None for name in CLASS_ORDER
    }

    narrative = (
        "**VLM Vision-Language Interpretation**\n\n"
        + (
            "A trained vision-language checkpoint is loadable; its interpretation is reported here."
            if trained_vlm
            else "No trained VLM checkpoint is loadable for this pipeline, so this module explains the "
            "measured Python analysis instead of claiming model-generated text."
        )
        + "\n\n"
        + (
            f"The scene is predominantly {CLASS_LABELS[dominant].lower()}-covered: "
            f"water {_percent(measured['water'])}, vegetation {_percent(measured['vegetation'])}, "
            f"built-up {_percent(measured['built_up'])}, bare land {_percent(measured['bare_land'])}."
            if dominant
            else "The measured class distribution does not support a dominant-surface statement."
        )
        + "\n\n"
        + (
            f"Where: water extent {_region_envelope(analysis, 'water') or AVAILABLE}; "
            f"vegetation extent {_region_envelope(analysis, 'vegetation') or AVAILABLE}; "
            f"built-up extent {_region_envelope(analysis, 'built_up') or AVAILABLE} "
            "(image-relative coordinates).\n\n"
        )
        + f"Question addressed: {question or 'general scene interpretation'}\n\n"
        "Constraint: every number quoted above comes from the measured analysis; no value is estimated "
        "by a language model.\n\n"
        f"Limitations: {analysis.get('confidence_basis')}"
    )

    return _payload(
        "vlm",
        available=True,
        result={
            "trained_vlm_available": trained_vlm,
            "interpretation_source": "trained VLM checkpoint"
            if trained_vlm
            else "measured-analysis explanation",
            "measured_classes": measured,
            "dominant_class": dominant,
            "quoted_measurements": {
                "water_percent": measured["water"],
                "vegetation_percent": measured["vegetation"],
                "built_up_percent": measured["built_up"],
            },
        },
        narrative=narrative,
        evidence=[
            f"Trained VLM available: {'yes' if trained_vlm else 'no'}",
            f"Dominant class: {CLASS_LABELS[dominant] if dominant else AVAILABLE}",
            f"Method: {analysis.get('method')}",
        ],
        method=analysis.get("method", ""),
        limitations=_method_limitations(analysis)
        + (
            []
            if trained_vlm
            else ["No trained VLM checkpoint is loaded; text is generated from measured values."]
        ),
        key_findings=[
            f"Water: {_percent(measured['water'])}",
            f"Vegetation: {_percent(measured['vegetation'])}",
            f"Built-up: {_percent(measured['built_up'])}",
        ],
        plan=plan,
    )


MODULE_ANALYZERS = {
    "mission_overview": analyze_mission_overview,
    "geoscope": analyze_geoscope,
    "live_aoi": analyze_aoi,
    "map_viewer": analyze_map_viewer,
    "change_detection": analyze_change_detection,
    "spectral_indices": analyze_spectral_indices,
    "land_cover": analyze_land_cover,
    "object_detection": analyze_objects,
    "sam_segmentation": analyze_sam_segmentation,
    "disaster": analyze_disaster,
    "agriculture": analyze_agriculture,
    "ndvi_health": analyze_ndvi_health,
    "urban_growth": analyze_urban_growth,
    "ndbi": analyze_ndbi,
    "water_vegetation": analyze_water_vegetation,
    "water_analysis": analyze_water_analysis,
    "vegetation_analysis": analyze_vegetation_analysis,
    "urban_analysis": analyze_urban_analysis,
    "vlm": analyze_vlm,
}


def run_module_analysis(
    module: str,
    analysis: Dict[str, Any],
    question: str = "",
    image_metadata: Optional[Dict[str, Any]] = None,
    plan: Optional[Dict[str, Any]] = None,
    secondary_analysis: Optional[Dict[str, Any]] = None,
    coverage_deltas: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Dispatch to the module-specific analyzer (never a generic fallback answer)."""
    analyzer = MODULE_ANALYZERS.get(module) or MODULE_ANALYZERS["mission_overview"]
    return analyzer(
        analysis,
        question=question,
        image_metadata=image_metadata,
        plan=plan,
        secondary_analysis=secondary_analysis,
        coverage_deltas=coverage_deltas,
    )
