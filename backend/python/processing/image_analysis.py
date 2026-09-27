"""Image-derived satellite measurements for RGB and multispectral imagery."""

from __future__ import annotations

import base64
import io
import re
from pathlib import Path
from typing import Any
from urllib.request import urlopen

import numpy as np
from PIL import Image
from rasterio.enums import Resampling
from rasterio.io import MemoryFile
from rasterio.warp import transform_bounds


MAX_IMAGE_BYTES = 50 * 1024 * 1024
MAX_IMAGE_SIDE = 512
CLASS_NAMES = ("water", "vegetation", "built_up", "bare_land", "other")
CLASS_COLORS = {
    "water": (25, 118, 210, 150),
    "vegetation": (46, 160, 67, 150),
    "built_up": (230, 126, 34, 150),
    "bare_land": (226, 190, 90, 120),
    "other": (0, 0, 0, 0),
}


def _image_bytes(image: dict[str, Any]) -> bytes:
    source = image.get("file_url") or image.get("image_data") or image.get("imageBase64")
    if not isinstance(source, str) or not source:
        raise ValueError("The uploaded image data is unavailable for analysis.")

    if source.startswith("data:"):
        header, separator, encoded = source.partition(",")
        if not separator:
            raise ValueError("The uploaded image data URI is malformed.")
        raw = base64.b64decode(encoded, validate=False)
    elif source.startswith(("http://", "https://")):
        with urlopen(source, timeout=20) as response:
            raw = response.read(MAX_IMAGE_BYTES + 1)
    elif source.startswith("file://"):
        raw = Path(source[7:]).read_bytes()
    else:
        raw = Path(source).read_bytes()

    if not raw:
        raise ValueError("The uploaded image is empty.")
    if len(raw) > MAX_IMAGE_BYTES:
        raise ValueError("The uploaded image exceeds the 50 MB analysis limit.")
    return raw


def _bounded_shape(height: int, width: int) -> tuple[int, int]:
    scale = min(1.0, MAX_IMAGE_SIDE / max(height, width))
    return max(1, round(height * scale)), max(1, round(width * scale))


def _read_raster(raw: bytes, image: dict[str, Any]) -> tuple[np.ndarray, np.ndarray, list[str], dict[str, Any] | None] | None:
    try:
        with MemoryFile(raw) as memory_file, memory_file.open() as dataset:
            out_height, out_width = _bounded_shape(dataset.height, dataset.width)
            raster = dataset.read(
                out_shape=(dataset.count, out_height, out_width),
                masked=True,
                resampling=Resampling.nearest,
            )
            data = np.asarray(raster.astype(np.float32).filled(np.nan), dtype=np.float32)
            valid = dataset.dataset_mask(
                out_shape=(out_height, out_width),
                resampling=Resampling.nearest,
            ) > 0
            descriptions = list(dataset.descriptions or ())
            color_interpretations = [item.name for item in dataset.colorinterp]
            names = [
                descriptions[index] or color_interpretations[index]
                for index in range(dataset.count)
            ]
            geo_bounds = None
            if dataset.crs and not dataset.transform.is_identity:
                west, south, east, north = transform_bounds(
                    dataset.crs,
                    "EPSG:4326",
                    *dataset.bounds,
                    densify_pts=21,
                )
                geo_bounds = {
                    "west": west,
                    "south": south,
                    "east": east,
                    "north": north,
                    "crs": "EPSG:4326",
                    "source": "raster geotransform",
                }
            metadata_bands = image.get("bands") or []
            if len(metadata_bands) == dataset.count:
                names = [
                    description or str(metadata_bands[index])
                    for index, description in enumerate(names or [""] * dataset.count)
                ]
            return data, valid, names, geo_bounds
    except Exception:
        return None


def _read_rgb(raw: bytes) -> tuple[np.ndarray, np.ndarray]:
    with Image.open(io.BytesIO(raw)) as source:
        source.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE), Image.Resampling.LANCZOS)
        rgba = np.asarray(source.convert("RGBA"), dtype=np.uint8)
    return rgba[:, :, :3].astype(np.float32), rgba[:, :, 3] > 0


def _role_for_band(name: str, satellite: str) -> str | None:
    label = name.lower().replace("_", " ")
    if "near infrared" in label or "near-infrared" in label or re.search(r"\bnir\b", label):
        return "nir"
    if "shortwave infrared" in label or re.search(r"\bswir\b", label):
        return "swir"
    if re.search(r"\bgreen\b", label):
        return "green"
    if re.search(r"\bred\b", label):
        return "red"
    if re.search(r"\bblue\b", label):
        return "blue"

    band_match = re.search(r"\bb\s*0*(\d{1,2})\s*(a)?\b", label)
    if not band_match:
        return None
    band_number = int(band_match.group(1))
    satellite_name = re.sub(r"[\s_]+", "-", satellite.lower())

    if band_number == 3 and "sentinel" in satellite_name:
        return "green"
    if band_number == 4 and "sentinel" in satellite_name:
        return "red"
    if band_number in (8, 9) and "sentinel" in satellite_name:
        return "nir"
    if band_number in (11, 12) and "sentinel" in satellite_name:
        return "swir"
    if band_number == 3 and ("landsat-8" in satellite_name or "landsat-9" in satellite_name):
        return "green"
    if band_number == 4 and ("landsat-8" in satellite_name or "landsat-9" in satellite_name):
        return "red"
    if band_number == 2 and ("landsat-8" in satellite_name or "landsat-9" in satellite_name):
        return "blue"
    if band_number == 5 and ("landsat-8" in satellite_name or "landsat-9" in satellite_name):
        return "nir"
    if band_number == 6 and ("landsat-8" in satellite_name or "landsat-9" in satellite_name):
        return "swir"
    return None


def _band_indices(names: list[str], image: dict[str, Any], band_count: int) -> dict[str, int]:
    result: dict[str, int] = {}
    metadata_bands = image.get("bands") or []
    candidates = names if len(names) == band_count else []
    if len(metadata_bands) == band_count:
        candidates = [
            candidates[index] if candidates and candidates[index] else str(metadata_bands[index])
            for index in range(band_count)
        ]
    for index, name in enumerate(candidates):
        role = _role_for_band(str(name), str(image.get("satellite") or image.get("sensor") or ""))
        if role and role not in result:
            result[role] = index
    return result


def _geographic_bounds(image: dict[str, Any], raster_bounds: dict[str, Any] | None) -> dict[str, Any] | None:
    bbox = image.get("bbox")
    if isinstance(bbox, dict):
        try:
            bounds = {key: float(bbox[key]) for key in ("west", "south", "east", "north")}
            if (
                all(np.isfinite(value) for value in bounds.values())
                and -180 <= bounds["west"] < bounds["east"] <= 180
                and -90 <= bounds["south"] < bounds["north"] <= 90
            ):
                return {**bounds, "crs": "EPSG:4326", "source": "image geographic bounds"}
        except (KeyError, TypeError, ValueError):
            pass
    return raster_bounds


def _rgb_class_masks(rgb: np.ndarray) -> dict[str, np.ndarray]:
    colors = rgb / 255.0
    red, green, blue = (colors[:, :, index] for index in range(3))
    brightness = (red + green + blue) / 3.0
    maximum = np.max(colors, axis=2)
    minimum = np.min(colors, axis=2)
    saturation = np.divide(maximum - minimum, maximum, out=np.zeros_like(maximum), where=maximum > 0)
    excess_green = 2.0 * green - red - blue

    water = (
        ((blue > red * 1.10) & (green > red * 1.05) & (blue >= green * 0.90) & (brightness < 0.88))
        | ((green > red * 1.15) & (blue > red * 1.08) & (blue >= green * 0.90) & (brightness < 0.78))
        | ((brightness < 0.20) & (blue >= red) & (green >= red))
    )
    vegetation = (
        (green > red * 1.08)
        & (green >= blue * 0.96)
        & (excess_green > 0.035)
        & ~water
    )
    built_up = (
        (saturation < 0.16)
        & (brightness > 0.18)
        & (brightness < 0.88)
        & ~water
        & ~vegetation
    )
    bare_land = (
        (red >= green * 1.04)
        & (saturation >= 0.12)
        & ~water
        & ~vegetation
        & ~built_up
    )

    assigned = water | vegetation | built_up | bare_land
    return {
        "water": water,
        "vegetation": vegetation,
        "built_up": built_up,
        "bare_land": bare_land,
        "other": ~assigned,
    }


def _encode_overlay(masks: dict[str, np.ndarray]) -> str:
    height, width = next(iter(masks.values())).shape
    rgba = np.zeros((height, width, 4), dtype=np.uint8)
    for name in CLASS_NAMES:
        rgba[masks[name]] = CLASS_COLORS[name]
    image = Image.fromarray(rgba, mode="RGBA")
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(output.getvalue()).decode("ascii")


def _encode_index_overlay(values: np.ndarray, valid: np.ndarray, index_name: str) -> str:
    selected = valid & np.isfinite(values)
    scaled = np.clip((values + 1.0) / 2.0, 0.0, 1.0)
    if index_name == "ndvi":
        red = np.clip(255 * (1.0 - scaled) * 1.7, 0, 255)
        green = np.clip(255 * scaled * 1.4, 0, 255)
        blue = np.clip(90 * (1.0 - scaled), 0, 255)
    elif index_name in ("ndwi", "mndwi"):
        red = np.clip(255 * (1.0 - scaled), 0, 255)
        green = np.clip(150 * scaled, 0, 255)
        blue = np.clip(255 * scaled, 0, 255)
    else:
        red = np.clip(255 * scaled, 0, 255)
        green = np.clip(140 * scaled, 0, 255)
        blue = np.clip(255 * (1.0 - scaled), 0, 255)

    rgba = np.zeros((*values.shape, 4), dtype=np.uint8)
    rgba[:, :, 0] = np.where(selected, red, 0).astype(np.uint8)
    rgba[:, :, 1] = np.where(selected, green, 0).astype(np.uint8)
    rgba[:, :, 2] = np.where(selected, blue, 0).astype(np.uint8)
    rgba[:, :, 3] = np.where(selected, 150, 0).astype(np.uint8)
    output = io.BytesIO()
    Image.fromarray(rgba, mode="RGBA").save(output, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(output.getvalue()).decode("ascii")


def _reduce_mask(mask: np.ndarray, max_side: int = 64) -> np.ndarray:
    """Block-reduce a boolean mask so region labelling stays cheap."""
    height, width = mask.shape
    scale = max(1, int(np.ceil(max(height, width) / float(max_side))))
    if scale == 1:
        return mask
    padded_height = height + (-height) % scale
    padded_width = width + (-width) % scale
    padded = np.zeros((padded_height, padded_width), dtype=bool)
    padded[:height, :width] = mask
    return padded.reshape(
        padded_height // scale, scale, padded_width // scale, scale
    ).any(axis=(1, 3))


def _region_cell_counts(mask: np.ndarray) -> list[int]:
    """Connected-component cell counts of a reduced boolean mask (4-connectivity)."""
    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    counts: list[int] = []
    neighbours = ((1, 0), (-1, 0), (0, 1), (0, -1))
    for row in range(height):
        for column in range(width):
            if not mask[row, column] or visited[row, column]:
                continue
            visited[row, column] = True
            stack = [(row, column)]
            cells = 0
            while stack:
                current_row, current_column = stack.pop()
                cells += 1
                for delta_row, delta_column in neighbours:
                    next_row = current_row + delta_row
                    next_column = current_column + delta_column
                    if (
                        0 <= next_row < height
                        and 0 <= next_column < width
                        and mask[next_row, next_column]
                        and not visited[next_row, next_column]
                    ):
                        visited[next_row, next_column] = True
                        stack.append((next_row, next_column))
            counts.append(cells)
    return counts


def _class_region_summary(masks: dict[str, np.ndarray], valid: np.ndarray) -> dict[str, Any]:
    """Count measured class regions so modules can report spatial structure honestly."""
    summary: dict[str, Any] = {}
    for name in ("water", "vegetation", "built_up"):
        mask = masks.get(name)
        entry: dict[str, Any] = {
            "region_count": 0,
            "largest_region_share_percent": 0.0,
            "mask_cells": 0,
            "working_grid": None,
            "resolution_note": "region counts are computed on a reduced working mask",
        }
        if mask is None or not np.any(mask):
            summary[name] = entry
            continue
        selected = mask & valid
        reduced = _reduce_mask(selected)
        counts = _region_cell_counts(reduced)
        total_cells = int(sum(counts))
        entry.update({
            "region_count": len(counts),
            "largest_region_share_percent": (
                round(100.0 * max(counts) / total_cells, 2) if total_cells else 0.0
            ),
            "mask_cells": total_cells,
            "working_grid": [int(reduced.shape[0]), int(reduced.shape[1])],
        })
        summary[name] = entry
    return summary


def _indices(data: np.ndarray, valid: np.ndarray, bands: dict[str, int]) -> dict[str, Any]:
    result: dict[str, Any] = {}

    def calculate(name: str, first: str, second: str, first_term: str, second_term: str) -> None:
        if first not in bands or second not in bands:
            return
        left = data[bands[first]]
        right = data[bands[second]]
        denominator = left + right
        selected = valid & np.isfinite(left) & np.isfinite(right) & (np.abs(denominator) > 1e-8)
        if not np.any(selected):
            return
        values = np.clip((left[selected] - right[selected]) / denominator[selected], -1.0, 1.0)
        result[name] = {
            "mean": float(np.mean(values)),
            "median": float(np.median(values)),
            "minimum": float(np.min(values)),
            "maximum": float(np.max(values)),
            "pixel_count": int(values.size),
            "formula": f"({first_term} - {second_term}) / ({first_term} + {second_term})",
        }

    calculate("ndvi", "nir", "red", "NIR", "Red")
    calculate("ndwi", "green", "nir", "Green", "NIR")
    calculate("mndwi", "green", "swir", "Green", "SWIR")
    calculate("ndbi", "swir", "nir", "SWIR", "NIR")
    return result


def analyze_satellite_image(image: dict[str, Any]) -> dict[str, Any]:
    """Decode and measure an uploaded raster; never synthesize unavailable indices."""
    raw = _image_bytes(image)
    raster = _read_raster(raw, image)

    if raster is None:
        rgb, valid = _read_rgb(raw)
        image_type = "rgb"
        data = np.moveaxis(rgb, -1, 0)
        band_map: dict[str, int] = {}
        rgb_for_classification = rgb
    else:
        data, valid, names, raster_bounds = raster
        band_map = _band_indices(names, image, data.shape[0])
        image_type = (
            "multispectral"
            if "nir" in band_map or "swir" in band_map
            or (data.shape[0] > 3 and "alpha" not in {name.lower() for name in names})
            else "rgb"
        )
        rgb_indices = [band_map.get(channel) for channel in ("red", "green", "blue")]
        if all(index is not None for index in rgb_indices):
            rgb_for_classification = np.moveaxis(data[rgb_indices], 0, -1)
            finite_rgb = rgb_for_classification[np.isfinite(rgb_for_classification)]
            scale = float(np.percentile(finite_rgb, 99)) if finite_rgb.size else 1.0
            if 0.0 < scale <= 1.0:
                rgb_for_classification = rgb_for_classification * 255.0
            elif scale > 1.0:
                rgb_for_classification = rgb_for_classification / scale * 255.0
        else:
            rgb_for_classification = None

    valid = valid & np.all(np.isfinite(data), axis=0)
    if not np.any(valid):
        raise ValueError("The uploaded image contains no valid pixels to analyze.")
    geo_bounds = _geographic_bounds(image, raster_bounds if raster is not None else None)

    spectral = _indices(data, valid, band_map) if image_type == "multispectral" else {}
    rgb_masks = None
    computed_indices: dict[str, np.ndarray] = {}
    water_values: np.ndarray | None = None
    ndvi_values: np.ndarray | None = None
    ndbi_values: np.ndarray | None = None
    if rgb_for_classification is not None:
        rgb_masks = _rgb_class_masks(rgb_for_classification)
    elif image_type == "rgb":
        rgb_masks = _rgb_class_masks(np.moveaxis(data[:3], 0, -1))

    if image_type == "multispectral":
        def normalized_difference(first: str, second: str) -> np.ndarray | None:
            if first not in band_map or second not in band_map:
                return None
            left = data[band_map[first]]
            right = data[band_map[second]]
            denominator = left + right
            return np.divide(
                left - right,
                denominator,
                out=np.full(valid.shape, np.nan, dtype=np.float32),
                where=np.abs(denominator) > 1e-8,
            )

        water_values = normalized_difference("green", "swir")
        if water_values is None:
            water_values = normalized_difference("green", "nir")
        ndvi_values = normalized_difference("nir", "red")
        ndbi_values = normalized_difference("swir", "nir")
        if water_values is not None:
            computed_indices["mndwi" if "swir" in band_map else "ndwi"] = water_values
        if ndvi_values is not None:
            computed_indices["ndvi"] = ndvi_values
        if ndbi_values is not None:
            computed_indices["ndbi"] = ndbi_values

        water_mask = (
            water_values > 0
            if water_values is not None
            else rgb_masks["water"] if rgb_masks is not None else np.zeros(valid.shape, dtype=bool)
        )
        vegetation_mask = (
            ndvi_values > 0.2
            if ndvi_values is not None
            else rgb_masks["vegetation"] if rgb_masks is not None else np.zeros(valid.shape, dtype=bool)
        )
        built_mask = (
            ndbi_values > 0
            if ndbi_values is not None
            else rgb_masks["built_up"] if rgb_masks is not None else np.zeros(valid.shape, dtype=bool)
        )
        water_mask = water_mask & valid
        vegetation_mask = vegetation_mask & valid & ~water_mask
        built_mask = built_mask & valid & ~water_mask & ~vegetation_mask
        all_primary_masks_available = rgb_masks is not None or all(
            values is not None
            for values in (water_values, ndvi_values, ndbi_values)
        )
        class_masks = {
            "water": water_mask,
            "vegetation": vegetation_mask,
            "built_up": built_mask,
            "bare_land": (
                valid & ~water_mask & ~vegetation_mask & ~built_mask
                if all_primary_masks_available
                else np.zeros(valid.shape, dtype=bool)
            ),
            "other": np.zeros(valid.shape, dtype=bool),
        }
    else:
        if rgb_masks is None:
            raise ValueError("The uploaded image does not contain readable RGB pixels.")
        class_masks = {name: mask & valid for name, mask in rgb_masks.items()}

    valid_count = int(np.count_nonzero(valid))
    has_rgb_classification = rgb_masks is not None
    class_availability = {
        "water": has_rgb_classification or water_values is not None,
        "vegetation": has_rgb_classification or ndvi_values is not None,
        "built_up": has_rgb_classification or ndbi_values is not None,
    }
    all_primary_classes_available = all(class_availability.values())
    class_availability["bare_land"] = all_primary_classes_available
    class_availability["other"] = all_primary_classes_available
    class_percentages = {
        name: (
            round(float(np.count_nonzero(class_masks[name] & valid)) * 100.0 / valid_count, 2)
            if class_availability[name]
            else None
        )
        for name in CLASS_NAMES
    }
    class_pixel_counts = {
        name: (
            int(np.count_nonzero(class_masks[name] & valid))
            if class_availability[name]
            else None
        )
        for name in CLASS_NAMES
    }
    if all_primary_classes_available:
        rounding_delta = round(100.0 - sum(class_percentages.values()), 2)
        class_percentages["other"] = round(class_percentages["other"] + rounding_delta, 2)

    ndvi = spectral.get("ndvi")
    if ndvi:
        vegetation_pixels = valid & np.isfinite(ndvi_values) & (ndvi_values > 0.2)
        vegetation_percentage = round(float(np.count_nonzero(vegetation_pixels)) * 100.0 / valid_count, 2)
        if ndvi["mean"] > 0.5:
            ndvi["health_interpretation"] = "Dense/healthy vegetation range on average"
        elif ndvi["mean"] > 0.2:
            ndvi["health_interpretation"] = "Moderate vegetation range on average"
        elif ndvi["mean"] >= 0:
            ndvi["health_interpretation"] = "Sparse vegetation or bare-soil range on average"
        else:
            ndvi["health_interpretation"] = "Predominantly non-vegetated or water-like values on average"
    elif class_availability["vegetation"]:
        vegetation_percentage = class_percentages["vegetation"]
    else:
        vegetation_percentage = None

    method = (
        "RGB color-feature classification estimate"
        if image_type == "rgb"
        else (
            f"Threshold segmentation using mapped {', '.join(name.upper() for name in computed_indices)}"
            if computed_indices
            else "No supported multispectral bands mapped for land-cover classification"
        )
    )
    masks_for_overlay = {
        name: class_masks[name] & valid
        for name in CLASS_NAMES
    }
    overlay_url = _encode_overlay(masks_for_overlay)
    overlays = {"land_cover": overlay_url}
    overlays.update({
        name: _encode_index_overlay(values, valid, name)
        for name, values in computed_indices.items()
    })
    regions: dict[str, dict[str, float]] = {}
    for name in ("water", "vegetation", "built_up"):
        rows, columns = np.where(masks_for_overlay[name])
        if rows.size:
            regions[name] = {
                "xmin": float(columns.min() / valid.shape[1]),
                "ymin": float(rows.min() / valid.shape[0]),
                "xmax": float((columns.max() + 1) / valid.shape[1]),
                "ymax": float((rows.max() + 1) / valid.shape[0]),
            }

    return {
        "available": True,
        "image_type": image_type,
        "width": int(valid.shape[1]),
        "height": int(valid.shape[0]),
        "total_pixels": int(valid.size),
        "valid_pixel_count": valid_count,
        "class_percentages": class_percentages,
        "class_pixel_counts": class_pixel_counts,
        "class_availability": class_availability,
        "water_detected": (
            class_percentages["water"] > 0
            if class_availability["water"]
            else None
        ),
        "vegetation_percentage": vegetation_percentage,
        "indices": spectral,
        "ndvi_available": ndvi is not None,
        "band_mapping": {key: int(index) + 1 for key, index in band_map.items()},
        "water_index": "MNDWI" if "mndwi" in spectral else ("NDWI" if "ndwi" in spectral else None),
        "method": method,
        "confidence_basis": (
            "Deterministic spectral indices and threshold masks; not a supervised per-pixel classifier."
            if image_type == "multispectral" and computed_indices
            else (
                "No supported spectral bands were mapped; land-cover classes are unavailable."
                if image_type == "multispectral"
                else "RGB color cues only; surface classes are estimates and spectral indices are unavailable."
            )
        ),
        "regions_image_relative": regions,
        "class_regions": _class_region_summary(masks_for_overlay, valid),
        "georeferencing": {
            "available": geo_bounds is not None,
            "bounds": geo_bounds,
        },
        "overlays": overlays,
    }


def _generate_legacy_analysis_summary(question: str, analysis: dict[str, Any]) -> str:
    """Retained for migration compatibility with stored outputs."""
    if not analysis.get("available"):
        return "The uploaded image could not be measured; no image-derived coverage or index values are available."

    q = question.lower()
    classes = analysis["class_percentages"]
    class_availability = analysis.get("class_availability", {})
    water = classes["water"]
    vegetation = analysis["vegetation_percentage"]
    built = classes["built_up"]
    bare = classes["bare_land"]
    ndvi = analysis["indices"].get("ndvi")
    ndwi = analysis["indices"].get("mndwi") or analysis["indices"].get("ndwi")
    percent = lambda value: f"{value:.2f}%" if value is not None else "unavailable"
    available_classes = {
        name: value
        for name, value in classes.items()
        if value is not None and class_availability.get(name, True)
    }
    dominant = (
        max(available_classes, key=available_classes.get).replace("_", " ")
        if available_classes
        else "unavailable"
    )
    measured_by = f"Method: {analysis['method']}."
    ndvi_limitation = (
        "True NDVI cannot be calculated because the uploaded RGB image does not contain a near-infrared band."
        if analysis["image_type"] == "rgb"
        else "True NDVI cannot be calculated because the uploaded multispectral image does not contain mapped Red and near-infrared bands."
    )
    water_evidence = (
        f"Water index: {analysis['water_index']}."
        if analysis["water_index"]
        else (
            "RGB-only color estimate; a spectral water index is unavailable."
            if class_availability.get("water", True)
            else "Water coverage is unavailable because no usable RGB or mapped spectral bands were found."
        )
    )
    bounds = analysis["regions_image_relative"]
    georef = analysis.get("georeferencing", {}).get("available", False)
    where_note = (
        f" Image-relative extent (normalized x/y 0-1): {bounds['water']}."
        if "water" in bounds and any(term in q for term in ("where", "locate", "position"))
        else ""
    )
    ndvi_result = (
        f"Mean NDVI {ndvi['mean']:.3f}; range {ndvi['minimum']:.3f} to {ndvi['maximum']:.3f}; "
        f"median {ndvi['median']:.3f}. {ndvi['health_interpretation']}."
        if ndvi
        else ndvi_limitation
    )

    if any(term in q for term in ("flood", "flooding", "inundat")):
        if not class_availability.get("water", True):
            return "Water coverage is unavailable because this image has neither readable RGB channels nor mapped Green and NIR/SWIR bands."
        return (
            f"Water-covered pixels were estimated at {percent(water)}. {water_evidence} "
            "Water detection alone cannot confirm flooding; confirmation requires temporal comparison or other contextual evidence."
        )

    if any(term in q for term in ("urban growth", "urban increase", "built-up growth", "built up growth")):
        return (
            f"Built-up-like coverage in this image is estimated at {percent(built)}. "
            "Urban growth cannot be measured from a single date; comparable imagery from at least two dates is required. "
            f"{measured_by}"
        )

    if any(term in q for term in ("change", "changed", "increase", "decrease", "trend")):
        return (
            "A single image cannot establish change over time. A second suitably comparable image is required; "
            "spatial change also requires georeferencing and co-registration."
        )

    if "water" in q and any(term in q for term in ("vegetat", "green cover", "canopy")):
        return (
            f"Image-derived coverage estimates: vegetation-like pixels {percent(vegetation)} and water {percent(water)}. "
            f"{measured_by} {water_evidence}"
        )

    if "ndvi" in q:
        if not ndvi:
            return ndvi_limitation
        return (
            f"NDVI was calculated as (NIR - Red) / (NIR + Red). "
            f"Mean {ndvi['mean']:.3f}, median {ndvi['median']:.3f}, minimum {ndvi['minimum']:.3f}, "
            f"maximum {ndvi['maximum']:.3f}. Pixels with NDVI > 0.2: {percent(vegetation)}. "
            f"{ndvi['health_interpretation']}"
        )

    if "ndwi" in q or "mndwi" in q:
        if not ndwi:
            return (
                "A true NDWI/MNDWI cannot be calculated because the required mapped Green and NIR/SWIR bands "
                "are unavailable in this image."
            )
        return (
            f"{analysis['water_index']} was calculated from mapped spectral bands. "
            f"Mean {ndwi['mean']:.3f}, median {ndwi['median']:.3f}, minimum {ndwi['minimum']:.3f}, "
            f"maximum {ndwi['maximum']:.3f}. Water-like coverage thresholded from the available water index: "
            f"{percent(water)}."
        )

    if "ndbi" in q:
        ndbi = analysis["indices"].get("ndbi")
        if not ndbi:
            return "A true NDBI cannot be calculated because mapped NIR and SWIR bands are unavailable."
        return (
            f"NDBI was calculated as (SWIR - NIR) / (SWIR + NIR). "
            f"Mean {ndbi['mean']:.3f}, median {ndbi['median']:.3f}, minimum {ndbi['minimum']:.3f}, "
            f"maximum {ndbi['maximum']:.3f}."
        )

    if any(term in q for term in ("water", "lake", "river", "flood", "reservoir")):
        if not class_availability.get("water", True):
            return "Water coverage is unavailable because this image has neither readable RGB channels nor mapped Green and NIR/SWIR bands."
        level_note = " This estimates surface coverage, not water level or depth." if "level" in q or "depth" in q else ""
        if any(term in q for term in ("is there", "any water", "water present")):
            return (
                f"{'Yes' if analysis['water_detected'] else 'No'} — water-like pixels occupy approximately "
                f"{percent(water)} of the image. {water_evidence}"
            )
        return (
            f"{'Yes' if analysis['water_detected'] else 'No'}, water-like pixels were detected. "
            f"Estimated water surface coverage: {percent(water)}. {measured_by} "
            f"{water_evidence}{level_note}{where_note}"
        )

    if any(term in q for term in ("building", "buildings", "individual object", "vehicle", "road")):
        built_estimate = (
            f"The threshold-based built-up-like surface estimate is {percent(built)}"
            if class_availability.get("built_up", True)
            else "A built-up-like surface estimate is unavailable because the required RGB or mapped NIR/SWIR bands are missing"
        )
        return (
            f"Individual {('building' if 'build' in q else 'object')} detection is not available in this image-analysis pipeline. "
            f"{built_estimate}; it is not a building count or object detection. "
            f"{measured_by}"
        )

    if any(term in q for term in ("urban", "built-up", "built up", "built area", "impervious")):
        if not class_availability.get("built_up", True):
            return "Built-up coverage is unavailable because this image has neither readable RGB channels nor mapped NIR and SWIR bands."
        ndbi = analysis["indices"].get("ndbi")
        index_note = f" Mean NDBI: {ndbi['mean']:.3f}." if ndbi else " NDBI is unavailable without mapped NIR and SWIR bands."
        return (
            f"Estimated built-up-like surface coverage: {percent(built)}.{index_note} "
            f"{measured_by} Threshold masks do not identify individual buildings."
        )

    if any(term in q for term in ("agriculture", "agricultural", "crop", "farm", "field")):
        if vegetation is None:
            return "Vegetation coverage is unavailable because this image has neither readable RGB channels nor mapped Red and near-infrared bands."
        vegetation_detail = (
            f" {ndvi_result}"
            if ndvi
            else " Crop type and crop condition cannot be established from RGB color estimates alone; "
            f"{ndvi_limitation}"
        )
        return (
            f"Vegetation-like coverage is estimated at {percent(vegetation)}. "
            "This is vegetation evidence, not a confirmed crop classification or yield assessment."
            f"{vegetation_detail} {measured_by}"
        )

    if any(term in q for term in ("vegetat", "forest", "tree", "canopy", "healthy", "health")):
        if vegetation is None:
            return "Vegetation coverage is unavailable because this image has neither readable RGB channels nor mapped Red and near-infrared bands."
        measure_note = f" {ndvi_result}" if ndvi else f" {ndvi_limitation}"
        region_note = (
            f" Approximate image-relative extent (normalized x/y 0-1): {bounds['vegetation']}."
            if "vegetation" in analysis["regions_image_relative"] and any(term in q for term in ("where", "locate", "position"))
            else ""
        )
        return (
            f"Vegetation-like coverage: {percent(vegetation)}.{measure_note} {measured_by}{region_note}"
        )

    if any(term in q for term in ("land cover", "land-cover", "land coverage", "land covered", "how much land")):
        return (
            "Land-cover estimates from the uploaded image:\n"
            f"- Vegetation: {percent(vegetation)}\n"
            f"- Water: {percent(water)}\n"
            f"- Built-up: {percent(built)}\n"
            f"- Bare land: {percent(bare)}\n"
            f"- Other: {percent(classes['other'])}\n"
            f"Dominant estimated class: {dominant}.\n"
            f"{measured_by} {analysis['confidence_basis']} "
            f"{ndvi_limitation if not ndvi else ''}"
        )

    if any(term in q for term in ("complete analysis", "analyze everything", "analyze this image", "analyze this satellite image", "analyze the image", "describe", "overview", "scene")):
        index_summary = (
            f" {ndvi_result}"
            if ndvi
            else f" {ndvi_limitation}"
        )
        geo_summary = (
            f" Geographic image bounds are available ({geo_bounds['source']})."
            if georef and (geo_bounds := analysis["georeferencing"]["bounds"])
            else " Georeferencing is unavailable; image-relative extents cannot be placed on a geographic map."
        )
        return (
            f"Image overview: the dominant measured class is {dominant} ({percent(classes[dominant.replace(' ', '_')])}).\n"
            f"- Vegetation: {percent(vegetation)}\n"
            f"- Water: {percent(water)}\n"
            f"- Built-up: {percent(built)}\n"
            f"- Bare land: {percent(bare)}\n"
            f"- Other: {percent(classes['other'])}\n"
            f"{index_summary} {measured_by}{geo_summary}\n"
            "Class percentages are image-derived estimates, not a supervised object detector."
        )

    lines = [
        f"Image pixels were measured using {analysis['method']}.",
        f"Question-specific land-cover estimate: dominant class {dominant}.",
    ]
    if ndvi:
        lines.append(f"NDVI mean {ndvi['mean']:.3f}, min {ndvi['minimum']:.3f}, max {ndvi['maximum']:.3f}.")
    else:
        lines.append(ndvi_limitation)
    lines.append("Ask about water, vegetation, built-up area, land cover, or indices for a focused measurement.")
    return "\n".join(lines)


def generate_analysis_summary(question: str, analysis: dict[str, Any]) -> str:
    """Generate a topic-specific interpretation from the measured image-analysis result."""
    if not analysis.get("available"):
        return _generate_legacy_analysis_summary(question, analysis)
    try:
        from processing.topic_interpreter import generate_analysis_summary as interpret
    except ImportError:
        from backend.python.processing.topic_interpreter import generate_analysis_summary as interpret
    return interpret(question, analysis)
