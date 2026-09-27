"""Question-aware explanations grounded in one verified image-analysis result."""

from __future__ import annotations

from typing import Any


def classify_question_intent(question: str) -> str:
    """Route a natural-language question to the narrowest supported topic."""
    q = " ".join(question.lower().replace("-", " ").split())

    if any(term in q for term in (
        "complete analysis", "analyze everything", "analyze this image",
        "analyze this satellite image", "analyze the image", "full analysis",
        "comprehensive analysis", "give me a complete",
    )):
        return "complete_analysis"
    if any(term in q for term in (
        "urban growth", "urban increase", "built up growth", "built-up growth",
        "has this area grown", "growth in this area",
    )):
        return "urban_growth"
    if any(term in q for term in (
        "what has changed", "what changed", "change detection",
        "detect changes", "changed over time", "change over time",
        "increase or decrease", "temporal change",
    )):
        return "change_detection"
    if any(term in q for term in ("flood", "flooding", "inundat")):
        return "flood"
    if any(term in q for term in (
        "disaster", "disasters", "damage assessment", "disaster analysis",
    )):
        return "disaster"
    if any(term in q for term in (
        "fire", "burned", "burnt", "burn scar", "scorched", "burn severity",
    )):
        return "fire"
    if "mndwi" in q or "ndwi" in q:
        return "ndwi"
    if "ndvi" in q:
        return "ndvi"
    if "ndbi" in q:
        return "ndbi"
    if any(term in q for term in (
        "are there buildings", "are buildings", "building detection",
        "are buildings visible", "detect buildings", "individual building", "individual object",
        "object detection", "vehicles", "roads visible",
    )):
        return "object_detection"
    if any(term in q for term in (
        "land cover", "landcover", "land coverage", "land covered",
        "land-cover", "land-cover class", "land cover class",
    )):
        return "land_cover"
    if any(term in q for term in (
        "agriculture", "agricultural", "crop", "farm", "field",
    )):
        return "agriculture"
    if any(term in q for term in (
        "vegetation health", "healthy is the vegetation", "health of vegetation",
        "vegetation healthy", "vegetation condition", "health status",
    )):
        return "vegetation_health"
    if any(term in q for term in (
        "compare vegetation and water", "compare water and vegetation",
        "vegetation versus water", "water versus vegetation",
    )):
        return "water_vegetation_comparison"
    if any(term in q for term in (
        "vegetation", "vegetated", "vegetation coverage", "green cover",
        "forest", "tree", "canopy", "healthy", "health",
    )):
        return "vegetation"
    if any(term in q for term in (
        "built up", "built-up", "built area", "urban", "impervious",
        "urban development",
    )):
        return "built_up"
    if any(term in q for term in (
        "is there water", "any water", "water present", "water in this image",
        "water visible", "water detected", "does this image contain water",
    )):
        return "water_detection"
    if any(term in q for term in (
        "water", "lake", "river", "reservoir", "water level", "water depth",
    )):
        return "water_coverage"
    if any(term in q for term in ("describe", "overview", "scene", "what is in")):
        return "general_scene_description"
    return "general_scene_description"


def _percent(value: Any) -> str:
    return f"{value:.2f}%" if isinstance(value, (int, float)) else "unavailable"


def _class_label(name: str) -> str:
    return {
        "built_up": "Built-up",
        "bare_land": "Bare land",
    }.get(name, name.replace("_", " ").title())


def _spatial_note(analysis: dict[str, Any], class_name: str) -> str:
    region = analysis.get("regions_image_relative", {}).get(class_name)
    if not region:
        return "No region for this class was delineated."
    return (
        "Image-relative extent (normalized x/y 0-1): "
        f"(x: {region['xmin']:.2f}-{region['xmax']:.2f}, "
        f"y: {region['ymin']:.2f}-{region['ymax']:.2f}); "
        "these are image-relative, not geographic coordinates."
    )


def _available_class_percentages(analysis: dict[str, Any]) -> dict[str, float]:
    percentages = analysis["class_percentages"]
    availability = analysis.get("class_availability", {})
    return {
        name: value
        for name, value in percentages.items()
        if isinstance(value, (int, float)) and availability.get(name, True)
    }


def _dominant_classes(analysis: dict[str, Any]) -> list[tuple[str, float]]:
    return sorted(
        _available_class_percentages(analysis).items(),
        key=lambda item: item[1],
        reverse=True,
    )


def _index_stats(name: str, index: dict[str, Any]) -> str:
    return (
        f"Mean {name}: {index['mean']:.3f}; median {index['median']:.3f}; "
        f"minimum {index['minimum']:.3f}; maximum {index['maximum']:.3f}."
    )


def _vegetation_interpretation(percentage: float | None) -> str:
    if percentage is None:
        return "Vegetation coverage is unavailable from the mapped image channels."
    if percentage < 5:
        return "Vegetation-like pixels occupy only a small fraction of the analyzed image."
    if percentage > 50:
        return "Vegetation-like pixels form the majority of the analyzed image."
    return "Vegetation-like pixels are present across a measurable, non-dominant portion of the image."


def generate_analysis_summary(question: str, analysis: dict[str, Any]) -> str:
    """Select relevant measured fields and interpret them for the question topic."""
    if not analysis.get("available"):
        return "The uploaded image could not be measured; no image-derived coverage or index values are available."

    intent = classify_question_intent(question)
    classes = analysis["class_percentages"]
    availability = analysis.get("class_availability", {})
    indices = analysis.get("indices", {})
    water = classes.get("water")
    vegetation = analysis.get("vegetation_percentage")
    built_up = classes.get("built_up")
    bare_land = classes.get("bare_land")
    water_available = availability.get("water", water is not None)
    vegetation_available = availability.get("vegetation", vegetation is not None)
    built_available = availability.get("built_up", built_up is not None)
    water_index = indices.get("mndwi") or indices.get("ndwi")
    water_index_name = analysis.get("water_index")
    ndvi = indices.get("ndvi")
    ndbi = indices.get("ndbi")
    method = analysis.get("method", "image-derived pixel analysis")
    confidence_basis = analysis.get("confidence_basis", "")
    water_measurement = (
        "Water coverage is unavailable: this image has neither readable RGB channels "
        "nor mapped Green and NIR/SWIR bands."
        if not water_available
        else (
            f"Estimated water surface coverage is **{_percent(water)}**. "
            f"Method: {method}. "
            + (
                f"The available {water_index_name} supports the spectral water estimate."
                if water_index_name
                else "This is an RGB color-based estimate; no spectral water index is available."
            )
        )
    )
    top_classes = _dominant_classes(analysis)
    dominant_name = top_classes[0][0].replace("_", " ") if top_classes else "unavailable"
    dominant_is_water = bool(top_classes and top_classes[0][0] == "water")
    class_location_requested = any(
        term in question.lower() for term in ("where", "locate", "location", "position")
    )

    if intent == "water_vegetation_comparison":
        if not water_available and not vegetation_available:
            return "Water and vegetation coverage are unavailable because no supported image channels were measured."
        return (
            f"**Water and Vegetation Comparison**\n\n"
            f"Estimated water coverage: **{_percent(water) if water_available else 'unavailable'}**. "
            f"Estimated vegetation-like coverage: "
            f"**{_percent(vegetation) if vegetation_available else 'unavailable'}**. "
            f"The largest measured class is {dominant_name}. Method: {method}."
        )

    if intent == "water_detection":
        if not water_available:
            return water_measurement
        detection = "Yes" if analysis.get("water_detected") else "No"
        dominance = "Water is the dominant detected surface class." if dominant_is_water else (
            f"Water is not the dominant class; {dominant_name} occupies the largest estimated share."
        )
        location = f" {_spatial_note(analysis, 'water')}" if class_location_requested else ""
        return (
            f"**Water Detection**\n\n{detection} — water-like pixels were detected in "
            f"approximately **{_percent(water)}** of the image. {dominance} "
            f"{water_measurement}{location}"
        )

    if intent == "water_coverage":
        if not water_available:
            return water_measurement
        comparison = (
            f" Water is the dominant estimated class at {_percent(water)}."
            if dominant_is_water
            else f" The largest class is {dominant_name} "
            f"({_percent(top_classes[0][1]) if top_classes else 'unavailable'})."
        )
        level_note = (
            " This is an estimate of water surface coverage in the image, not water level or depth."
            if any(term in question.lower() for term in ("level", "depth", "how much water"))
            else " This percentage describes image coverage, not water depth or level."
        )
        location = f" {_spatial_note(analysis, 'water')}" if class_location_requested else ""
        return (
            f"**Water Coverage Analysis**\n\n{water_measurement}{comparison}"
            f"{level_note}{location}"
        )

    if intent == "ndvi":
        if not ndvi:
            limitation = (
                "True NDVI cannot be calculated because the uploaded RGB image does not contain a near-infrared band."
                if analysis.get("image_type") == "rgb"
                else "True NDVI cannot be calculated because mapped Red and near-infrared bands are unavailable."
            )
            estimate = (
                f" RGB color analysis estimates vegetation-like coverage at **{_percent(vegetation)}**; "
                "that estimate is not NDVI."
                if vegetation_available
                else ""
            )
            return f"**NDVI**\n\n{limitation}{estimate}"
        location = (
            f" {_spatial_note(analysis, 'vegetation')}"
            if "vegetation" in analysis.get("regions_image_relative", {})
            else ""
        )
        return (
            f"**NDVI Analysis**\n\nNDVI = (NIR - Red) / (NIR + Red). "
            f"{_index_stats('NDVI', ndvi)} Pixels with NDVI > 0.2 cover "
            f"**{_percent(vegetation)}** of the image. {ndvi['health_interpretation']}."
            f"{location}"
        )

    if intent == "ndwi":
        if not water_index:
            return (
                "**NDWI Analysis**\n\nTrue NDWI cannot be calculated from the available image bands: "
                "mapped Green plus NIR (for NDWI) or Green plus SWIR (for MNDWI) are required."
            )
        return (
            f"**{water_index_name or 'Water Index'} Analysis**\n\n"
            f"{_index_stats(water_index_name or 'Water index', water_index)} "
            f"Water-like coverage from the measured index-based mask is **{_percent(water)}**. "
            f"Method: {method}. "
            + (
                _spatial_note(analysis, "water")
                if "water" in analysis.get("regions_image_relative", {})
                else "No water-like region was delineated."
            )
        )

    if intent == "ndbi":
        if not ndbi:
            return (
                "**NDBI Analysis**\n\nTrue NDBI cannot be calculated because mapped SWIR and NIR bands "
                "are unavailable."
            )
        return (
            f"**NDBI Analysis**\n\nNDBI = (SWIR - NIR) / (SWIR + NIR). "
            f"{_index_stats('NDBI', ndbi)} Built-up-like coverage is "
            f"**{_percent(built_up)}**."
        )

    if intent == "vegetation_health":
        if not vegetation_available:
            return "Vegetation health cannot be assessed because usable Red/NIR or RGB channels are unavailable."
        ndvi_limitation = (
            "True NDVI cannot be calculated because the RGB image does not contain a near-infrared band."
            if analysis.get("image_type") == "rgb"
            else "True NDVI cannot be calculated because mapped Red and near-infrared bands are unavailable."
        )
        if ndvi:
            return (
                f"**Vegetation Health**\n\nVegetation-like coverage is **{_percent(vegetation)}**. "
                f"{_index_stats('NDVI', ndvi)} {ndvi['health_interpretation']}. "
                "This health interpretation is based on NDVI range statistics; it is not a crop-specific diagnosis."
                + (f" {_spatial_note(analysis, 'vegetation')}" if class_location_requested else "")
            )
        return (
            f"**Vegetation Health**\n\nVegetation-like coverage is **{_percent(vegetation)}**. "
            f"{_vegetation_interpretation(vegetation)} "
            f"{ndvi_limitation} Color-based coverage does not measure plant health."
        )

    if intent == "vegetation":
        if not vegetation_available:
            return "Vegetation coverage is unavailable because no usable RGB or mapped Red/NIR channels were found."
        index_note = (
            f" NDVI mean is {ndvi['mean']:.3f} ({ndvi['health_interpretation'].lower()})."
            if ndvi
            else " True NDVI is unavailable because near-infrared data is not present."
        )
        return (
            f"**Vegetation Analysis**\n\nVegetation-like coverage is **{_percent(vegetation)}**. "
            f"{_vegetation_interpretation(vegetation)} "
            + (
                f"The dominant class is {dominant_name}."
                if dominant_name != "vegetation"
                else "Vegetation is the dominant measured class."
            )
            + index_note
            + (f" {_spatial_note(analysis, 'vegetation')}" if class_location_requested else "")
        )

    if intent == "land_cover":
        if not top_classes:
            return "Land-cover classes are unavailable because no supported image channels could be measured."
        breakdown = "\n".join(
            f"- {_class_label(name)}: {_percent(value)}"
            for name, value in top_classes
        )
        secondary = (
            f"{top_classes[1][0].replace('_', ' ')} ({_percent(top_classes[1][1])})"
            if len(top_classes) > 1
            else "no other class was measurable"
        )
        ndvi_note = (
            ""
            if ndvi
            else (
                " True NDVI cannot be calculated because the uploaded RGB image does not contain a near-infrared band."
                if analysis.get("image_type") == "rgb"
                else " True NDVI cannot be calculated because mapped Red and near-infrared bands are unavailable."
            )
        )
        return (
            f"**Land Cover Analysis**\n\nLand-cover estimates from the uploaded image:\n{breakdown}\n\n"
            f"The dominant estimated class is {dominant_name} "
            f"({_percent(top_classes[0][1])}); the next largest is {secondary}. "
            f"Method: {method}. {confidence_basis}{ndvi_note}"
        )

    if intent == "built_up":
        if not built_available:
            return "Built-up coverage is unavailable because no supported RGB or mapped NIR/SWIR channels were found."
        index_note = (
            f" Measured mean NDBI is {ndbi['mean']:.3f}."
            if ndbi
            else " NDBI is unavailable because mapped NIR and SWIR bands are absent."
        )
        return (
            f"**Built-up Analysis**\n\nEstimated built-up-like surface coverage is "
            f"**{_percent(built_up)}**. This represents the image-analysis surface class, "
            f"not a count of individual structures. {method}.{index_note}"
            + (f" {_spatial_note(analysis, 'built_up')}" if class_location_requested else "")
        )

    if intent == "object_detection":
        if not built_available:
            evidence = "No supported built-up surface estimate is available."
        else:
            evidence = (
                f"Built-up-like pixels cover **{_percent(built_up)}** of the image, "
                "but this mask is not an individual-building detector."
            )
        location = f" {_spatial_note(analysis, 'built_up')}" if class_location_requested else ""
        return (
            f"**Object Detection**\n\nThis analysis does not run a verified individual-building detector, "
            f"so it cannot confirm building objects or provide a building count. {evidence}{location}"
        )

    if intent == "agriculture":
        if not vegetation_available:
            return "Agricultural vegetation cannot be estimated because usable RGB or mapped Red/NIR bands are unavailable."
        ndvi_note = (
            f"{_index_stats('NDVI', ndvi)} {ndvi['health_interpretation']}."
            if ndvi
            else "True NDVI and crop health cannot be assessed because the image lacks mapped near-infrared data."
        )
        water_note = f" Water-like surface coverage is {_percent(water)}." if water_available else ""
        return (
            f"**Agriculture-focused Interpretation**\n\nVegetation-like coverage is "
            f"**{_percent(vegetation)}** and bare-land coverage is **{_percent(bare_land)}**. "
            f"{ndvi_note}{water_note} The available measurements do not classify crop species, confirm field boundaries, "
            "estimate yield, or establish irrigation; vegetation alone is not proof of agriculture."
        )

    if intent == "flood":
        if not water_available:
            return f"**Flood Indicators**\n\n{water_measurement}"
        extent = (
            "a large share of the scene"
            if isinstance(water, (int, float)) and water >= 50
            else "a limited share of the scene"
            if isinstance(water, (int, float)) and water < 10
            else "a measurable share of the scene"
        )
        return (
            f"**Flood Indicators**\n\n{water_measurement} The detected water occupies {extent}. "
            "A single image cannot confirm flooding: this could be a normal lake, river, reservoir, or coastline. "
            "Temporal comparison and local context are needed."
        )

    if intent == "fire":
        return (
            "**Fire / Burn Indicators**\n\nThis image-analysis result does not include a validated fire or burn-scar "
            "detector. No fire event can be confirmed from the land-cover percentages alone; a suitable thermal "
            "or burn-sensitive index (such as NBR) and contextual or temporal evidence would be needed."
        )

    if intent == "disaster":
        water_note = (
            f"Water-like coverage is **{_percent(water)}**; water extent alone does not establish a flood."
            if water_available
            else "Water coverage is unavailable from the mapped image channels."
        )
        return (
            f"**Disaster Indicators**\n\n{water_note} "
            "This analysis does not provide a validated fire, damage, or general disaster detector. "
            "No disaster is confirmed without event-specific imagery, temporal comparison, and contextual evidence."
        )

    if intent == "urban_growth":
        current = (
            f"Current built-up-like coverage is **{_percent(built_up)}**."
            if built_available
            else "Current built-up-like coverage is unavailable."
        )
        return (
            f"**Urban Growth**\n\nUrban growth cannot be determined from a single image. {current} "
            "Growth requires comparable imagery from at least two dates; this single-image result is not a temporal change measurement."
        )

    if intent == "change_detection":
        return (
            "**Change Detection**\n\nTemporal change cannot be established from this single-image analysis. "
            "A second comparable image with acquisition dates and compatible bands is required. "
            "Spatial change additionally requires co-registration."
        )

    if intent == "complete_analysis":
        if not top_classes:
            return "The uploaded image could not be classified because no supported channels were available."
        land_cover_summary = "\n".join(
            f"- {_class_label(name)}: {_percent(value)}"
            for name, value in top_classes
        )
        ndvi_summary = (
            _index_stats("NDVI", ndvi) + f" {ndvi['health_interpretation']}."
            if ndvi
            else "True NDVI cannot be calculated because mapped Red and NIR bands are unavailable."
        )
        water_index_summary = (
            _index_stats(water_index_name or "Water index", water_index)
            if water_index
            else "True NDWI/MNDWI cannot be calculated because required Green and NIR/SWIR bands are unavailable."
        )
        return (
            f"**Mission Overview**\nThe dominant measured class is {dominant_name} "
            f"({_percent(top_classes[0][1])}) across {analysis['valid_pixel_count']} valid pixels.\n\n"
            f"**Land Cover**\n{land_cover_summary}\n\n"
            f"**Water**\n{water_measurement}\n\n"
            f"**Vegetation**\nVegetation-like coverage: **{_percent(vegetation)}**. "
            f"{_vegetation_interpretation(vegetation)} {ndvi_summary}\n\n"
            f"**Built-up**\nBuilt-up-like coverage: **{_percent(built_up)}**. "
            f"{'Individual buildings are not detected by this mask.' if built_available else 'Not measurable from the mapped channels.'}\n\n"
            f"**Spectral Indices**\n{ndvi_summary} {water_index_summary}\n\n"
            f"**Grounded Regions**\n{', '.join(sorted(analysis.get('regions_image_relative', {}))) or 'No class-mask regions were delineated.'} "
            "Region envelopes, when available, are image-relative rather than geographic coordinates.\n\n"
            f"**Disaster / Agriculture Limitations**\nA single image and these surface masks do not confirm flooding, fire, crop type, yield, or disaster impact.\n\n"
            f"**Method and limitations**\n{method}. {confidence_basis}"
        )

    if intent == "general_scene_description":
        if not top_classes:
            return "The scene could not be described because no supported image channels were measurable."
        return (
            f"**Scene Overview**\nThe largest measured surface class is {dominant_name} "
            f"({_percent(top_classes[0][1])}); "
            + (
                f"the next largest is {top_classes[1][0].replace('_', ' ')} "
                f"({_percent(top_classes[1][1])}). "
                if len(top_classes) > 1
                else ""
            )
            + f"These are image-derived estimates from {analysis['valid_pixel_count']} valid pixels using {method}."
        )

    return "This image question could not be mapped to a supported analysis topic."


def generate_pair_analysis_summary(
    question: str,
    image_a: dict[str, Any],
    image_b: dict[str, Any],
    coverage_deltas: dict[str, float],
    compatible_basis: bool,
) -> str:
    """Interpret independently measured paired-image differences by question topic."""
    intent = classify_question_intent(question)
    date_a = image_a.get("acquisition_date") or "date unavailable"
    date_b = image_b.get("acquisition_date") or "date unavailable"
    transition = f"Image A ({date_a}) to image B ({date_b})"

    if not compatible_basis:
        return (
            f"**{intent.replace('_', ' ').title()} Comparison**\n\n"
            f"{transition}: both images were measured independently, but their analysis bases are not compatible "
            "and their measurements were not compared. No numeric class change or spatial change is inferred."
        )

    def delta_line(class_name: str) -> str:
        delta = coverage_deltas.get(class_name)
        if delta is None:
            return f"{_class_label(class_name)} coverage change is unavailable."
        direction = "increased" if delta > 0 else "decreased" if delta < 0 else "had no net change"
        return f"{_class_label(class_name)} coverage {direction} by {abs(delta):.2f} percentage points."

    if intent == "urban_growth":
        return (
            f"**Urban Growth Comparison**\n\n{transition}, "
            f"{delta_line('built_up')} This is a difference in image-wide built-up-like coverage, "
            "not pixel-aligned proof of urban expansion or land conversion."
        )

    if intent in ("water_detection", "water_coverage", "flood"):
        water_a = image_a["class_percentages"].get("water")
        water_b = image_b["class_percentages"].get("water")
        if intent == "flood":
            heading = "Flood Indicators Across Dates"
            caveat = " A change in water coverage alone does not confirm flooding."
        elif intent == "water_detection":
            heading = "Water Detection Comparison"
            caveat = " These are image-wide coverage estimates, not water-level measurements."
        else:
            heading = "Water Coverage Comparison"
            caveat = " These are surface-coverage estimates, not water depth or level."
        return (
            f"**{heading}**\n\n{transition}: water-like coverage changed from "
            f"**{_percent(water_a)}** to **{_percent(water_b)}**. {delta_line('water')}{caveat} "
            "Spatial inundation or flood progression is not established without co-registered pixel-level change analysis."
        )

    if intent in ("ndvi", "vegetation", "vegetation_health"):
        ndvi_a = image_a.get("indices", {}).get("ndvi")
        ndvi_b = image_b.get("indices", {}).get("ndvi")
        if intent == "ndvi":
            if not ndvi_a or not ndvi_b:
                return (
                    f"**NDVI Comparison**\n\n{transition}: valid NDVI is unavailable for one or both images "
                    "because mapped Red and NIR bands are required."
                )
            return (
                f"**NDVI Comparison**\n\n{transition}: mean NDVI changed from "
                f"{ndvi_a['mean']:.3f} to {ndvi_b['mean']:.3f} "
                f"({ndvi_b['mean'] - ndvi_a['mean']:+.3f}). "
                f"{delta_line('vegetation')} This is an image-wide index comparison, not pixel-aligned vegetation change."
            )
        result = (
            f"**Vegetation Change Comparison**\n\n{transition}: "
            f"{delta_line('vegetation')} "
        )
        if ndvi_a and ndvi_b:
            result += (
                f"Mean NDVI changed from {ndvi_a['mean']:.3f} to {ndvi_b['mean']:.3f} "
                f"({ndvi_b['mean'] - ndvi_a['mean']:+.3f}). "
            )
        else:
            result += "True NDVI is unavailable for one or both images because Red and NIR bands are required. "
        return result + "These are scene-level estimates, not spatially aligned change regions."

    if intent == "ndwi":
        index_a = image_a.get("indices", {}).get("mndwi") or image_a.get("indices", {}).get("ndwi")
        index_b = image_b.get("indices", {}).get("mndwi") or image_b.get("indices", {}).get("ndwi")
        if not index_a or not index_b:
            return (
                f"**Water Index Comparison**\n\n{transition}: valid NDWI/MNDWI values are unavailable "
                "for one or both images because mapped Green and NIR/SWIR bands are required."
            )
        return (
            f"**Water Index Comparison**\n\n{transition}: mean water index changed from "
            f"{index_a['mean']:.3f} to {index_b['mean']:.3f} "
            f"({index_b['mean'] - index_a['mean']:+.3f}). {delta_line('water')} "
            "This is an image-wide index comparison, not a pixel-aligned change map."
        )

    if intent == "built_up":
        return (
            f"**Built-up Coverage Comparison**\n\n{transition}: "
            f"{delta_line('built_up')} This is a difference in image-wide coverage, "
            "not pixel-aligned land conversion or an individual building count."
        )

    if intent == "object_detection":
        return (
            f"**Object Detection Comparison**\n\n{transition}: this pipeline has no verified "
            "individual-building detector, so building counts or object-level changes cannot be established. "
            f"{delta_line('built_up')} This is only a built-up-like mask comparison."
        )

    if intent in ("fire", "disaster"):
        return (
            f"**Disaster Indicator Comparison**\n\n{transition}: class-coverage changes can be measured, "
            f"but {delta_line('water')} Neither water change nor land-cover classes alone confirm a disaster. "
            "No validated fire/burn detector is available in this analysis."
        )

    if intent == "agriculture":
        return (
            f"**Agriculture-related Change**\n\n{transition}: {delta_line('vegetation')} "
            f"{delta_line('bare_land')} Vegetation change is not crop classification or yield change."
        )

    rows = "\n".join(
        f"- {_class_label(name)}: {delta_line(name)}"
        for name in ("water", "vegetation", "built_up", "bare_land", "other")
    )
    return (
        f"**{('Complete ' if intent == 'complete_analysis' else '')}Image Comparison**\n\n"
        f"{transition} (image B minus image A):\n{rows}\n\n"
        "These are differences in image-wide estimated class coverage, not pixel-aligned land conversion. "
        "Spatial change requires co-registration."
    )
