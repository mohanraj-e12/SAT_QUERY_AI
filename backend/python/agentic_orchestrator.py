"""
SatQuery AI - Agentic Query-Driven Orchestrator
Sequences and executes specialized remote-sensing agents and models:
- QueryUnderstandingAgent: Extracts intent, location, AOI, dates, phenomena, indices
- SatelliteDataRetrievalAgent: Manages Sentinel-2, Landsat, ISRO/Bhuvan, GEE catalogs
- PreprocessingAgent: Executes cloud masking, radiometric calibration, and ARD clipping
- GISAgent: Manages vector geometries, polygon area in km², buffers, and GeoJSON features
- RemoteSensingVisionAgent: Evaluates foundation models, SegFormer, SAM, and VQA specialists
- ChangeDetectionAgent: Quantifies bi-temporal transitions and multi-temporal land cover dynamics
- ExplanationAgent: Synthesizes explainable natural-language reports and actionable insights
"""
import time
import uuid
from typing import Dict, Any, List, Optional, Tuple

try:
    from models.registry import MODEL_REGISTRY, TOOL_REGISTRY
    from models.bigearthnet_vlm import BigEarthNetVLM
    from models.rsvqa_vrsbench import RSVQAandVRSBenchSpecialist
    from models.rs_grounding import RSGroundingSpecialist
    from models.cdvqa_change import CDVQABiTemporalSpecialist
    from models.optical_sar_fusion import OpticalSARFusionSpecialist
    from models.spectral_engine import RadiometricSpectralEngine
    from models.rs_ml_engine import rs_ml_engine
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
    from processing.image_analysis import analyze_satellite_image
    from processing.analysis_router import route_analysis
    from processing.module_analyzers import run_module_analysis
    from processing.topic_interpreter import generate_analysis_summary, generate_pair_analysis_summary
    from processing.savi import savi_nbr_processor
    from processing.change_detection import change_detector
    from processing.preprocessing import preprocessor
    from utils.satellite_validator import satellite_validator
    from agents.langgraph_orchestrator import langgraph_orchestrator
except ImportError:
    from backend.python.models.registry import MODEL_REGISTRY, TOOL_REGISTRY
    from backend.python.models.bigearthnet_vlm import BigEarthNetVLM
    from backend.python.models.rsvqa_vrsbench import RSVQAandVRSBenchSpecialist
    from backend.python.models.rs_grounding import RSGroundingSpecialist
    from backend.python.models.cdvqa_change import CDVQABiTemporalSpecialist
    from backend.python.models.optical_sar_fusion import OpticalSARFusionSpecialist
    from backend.python.models.spectral_engine import RadiometricSpectralEngine
    from backend.python.models.rs_ml_engine import rs_ml_engine
    from backend.python.agents.query_agent import query_agent
    from backend.python.agents.data_agent import data_agent
    from backend.python.agents.preprocessing_agent import preprocessing_agent
    from backend.python.agents.gis_agent import gis_agent
    from backend.python.agents.vision_agent import vision_agent
    from backend.python.agents.change_agent import change_agent
    from backend.python.agents.explanation_agent import explanation_agent
    from backend.python.processing.ndvi import ndvi_processor
    from backend.python.processing.ndwi import ndwi_processor
    from backend.python.processing.ndbi import ndbi_processor
    from backend.python.processing.image_analysis import analyze_satellite_image
    from backend.python.processing.analysis_router import route_analysis
    from backend.python.processing.module_analyzers import run_module_analysis
    from backend.python.processing.topic_interpreter import generate_analysis_summary, generate_pair_analysis_summary
    from backend.python.processing.savi import savi_nbr_processor
    from backend.python.processing.change_detection import change_detector
    from backend.python.processing.preprocessing import preprocessor
    from backend.python.utils.satellite_validator import satellite_validator
    from backend.python.agents.langgraph_orchestrator import langgraph_orchestrator

def _route_summary(route: Dict[str, Any]) -> Dict[str, Any]:
    """Compact routing decision exposed on every orchestrator response."""
    return {
        key: route.get(key)
        for key in (
            "module",
            "module_title",
            "route_source",
            "analysis_intent",
            "question_intent",
            "result_schema",
            "band_limitation_reported",
            "band_limitation_message",
            "available_bands",
            "missing_bands",
        )
    }


def _coverage_deltas(
    image_a: Dict[str, Any],
    image_b: Dict[str, Any],
) -> Dict[str, float]:
    """Image-B minus image-A class coverage in percentage points (comparable classes only)."""
    deltas: Dict[str, float] = {}
    classes_a = image_a.get("class_percentages") or {}
    classes_b = image_b.get("class_percentages") or {}
    availability_a = image_a.get("class_availability") or {}
    availability_b = image_b.get("class_availability") or {}
    for name in ("water", "vegetation", "built_up", "bare_land", "other"):
        value_a = classes_a.get(name)
        value_b = classes_b.get(name)
        if (
            availability_a.get(name)
            and availability_b.get(name)
            and isinstance(value_a, (int, float))
            and isinstance(value_b, (int, float))
        ):
            deltas[name] = round(float(value_b) - float(value_a), 2)
    return deltas


class AgenticOrchestrator:
    """
    Query-driven remote-sensing agentic controller.
    Interprets natural-language queries, audits inputs, selects specialist models & agents,
    executes workflows, and emits evidence-grounded responses with full execution provenance.
    """
    def __init__(self):
        self.bigearthnet = BigEarthNetVLM()
        self.rsvqa_vrsbench = RSVQAandVRSBenchSpecialist()
        self.grounding = RSGroundingSpecialist()
        self.cdvqa = CDVQABiTemporalSpecialist()
        self.optical_sar_fusion = OpticalSARFusionSpecialist()
        self.spectral_engine = RadiometricSpectralEngine()

    def process_query(
        self,
        query: str,
        primary_image: Dict[str, Any],
        secondary_image: Optional[Dict[str, Any]] = None,
        input_mode: str = "AUTO", # "SINGLE", "CROSS_MODAL_PAIR", "BITEMPORAL_PAIR", or "AUTO"
        user_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Full agentic remote-sensing query execution lifecycle.
        """
        start_time = time.time()
        trace: List[Dict[str, Any]] = []

        user_params = user_params or {}
        selected_module = user_params.get("selected_module") or user_params.get("module")
        if "custom_pixel_data" in user_params and "custom_pixel_data" not in primary_image:
            primary_image["custom_pixel_data"] = user_params["custom_pixel_data"]

        # -------------------------------------------------------------
        # STEP 1: Query Understanding & Parameter Extraction Agent
        # -------------------------------------------------------------
        t1_start = time.time()
        parsed_intent = query_agent.parse_query(query)
        extracted = parsed_intent["extracted_parameters"]
        has_pair = secondary_image is not None

        # Determine task based on intent and input mode
        if input_mode == "CROSS_MODAL_PAIR" or (has_pair and extracted["cues"]["is_cross_modal"]):
            task = "CROSS_MODAL_PAIR_ANALYSIS"
            task_desc = "Joint Information Extraction from Co-Registered Optical and SAR Pair"
        elif input_mode == "BITEMPORAL_PAIR" or (has_pair and extracted["cues"]["is_change"]):
            task = "BITEMPORAL_CHANGE_ANALYSIS"
            task_desc = "Multi-Temporal Change Understanding & CDVQA Reasoning"
        elif extracted["cues"]["is_grounding"]:
            task = "TEXT_GUIDED_REGION_GROUNDING"
            task_desc = "Text-Guided Spatial Bounding Box & Coordinate Grounding"
        elif extracted["cues"]["is_caption"]:
            task = "SCENE_CAPTIONING"
            task_desc = "VRSBench-Standard Comprehensive Remote Sensing Captioning"
        elif extracted["cues"]["is_change"]:
            task = "BITEMPORAL_CHANGE_ANALYSIS"
            task_desc = "Multi-Temporal Change Understanding (Historical Contextualized)"
        else:
            task = "SINGLE_IMAGE_VQA"
            task_desc = "RSVQA-Standard Visual Question Answering with Semantic Grounding"

        trace.append({
            "step": 1,
            "name": "Query Understanding Agent",
            "action": f"Extracted intent for '{query}' -> Task: {task}, Index: {extracted['spectral_index']}, Location: {extracted['location']}",
            "task_classified": task,
            "task_description": task_desc,
            "extracted_parameters": extracted,
            "duration_ms": round((time.time() - t1_start) * 1000, 2)
        })

        # -------------------------------------------------------------
        # STEP 2: Input Verification, Preprocessing & GIS Agent
        # -------------------------------------------------------------
        t2_start = time.time()
        
        # Satellite Authenticity Audit
        val_result = satellite_validator.validate_image(primary_image)
        if not val_result.get("is_valid", True):
            rejection_msg = (
                f"⚠️ **Invalid Image Detected**\n\n"
                f"**Please submit a valid satellite image.**\n\n"
                f"The provided image does not appear to be an Earth observation, satellite, or aerial remote-sensing scene ({val_result.get('detected_type')}: {val_result.get('reason')}).\n\n"
                f"SatQuery AI only processes geospatial Earth observation imagery (such as Sentinel-2, Landsat 8/9, PlanetScope, synthetic aperture radar (SAR), and aerial drone orthomosaics).\n\n"
                f"👉 Please submit a valid satellite image to perform land-cover classification, spectral indices, or change detection."
            )
            trace.append({
                "step": 2,
                "name": "Satellite Authenticity Verification Agent",
                "action": f"Rejection: Image identified as {val_result.get('detected_type')}. Blocked non-satellite analysis.",
                "status": "REJECTED_NON_SATELLITE",
                "duration_ms": round((time.time() - t2_start) * 1000, 2)
            })
            return {
                "success": False,
                "is_valid_satellite": False,
                "task": "INVALID_IMAGE_REJECTION",
                "query": query,
                "summary": rejection_msg,
                "direct_answer": rejection_msg,
                "statistics": {},
                "detections": [],
                "recommendations": [
                    "Please submit a valid satellite or aerial Earth observation image (.tif, .png, .jpg).",
                    "Ensure the image depicts a top-down nadir landscape, coastline, urban area, or agricultural plot."
                ],
                "execution_trace": trace,
                "total_latency_ms": round((time.time() - start_time) * 1000, 2)
            }

        image_analysis = analyze_satellite_image(primary_image)
        image_meta = {
            "mission": primary_image.get("mission"),
            "instrument": primary_image.get("instrument"),
            "datetime": primary_image.get("acquisition_date") or primary_image.get("datetime"),
            "bbox": primary_image.get("bbox"),
        }

        # Route the question + selected sidebar module to its own analyzer so each
        # module returns its own analysis instead of a generic fallback.
        module_route = route_analysis(
            question=query,
            selected_module=selected_module,
            analysis=image_analysis,
            image_metadata=image_meta,
        )
        module_payload = run_module_analysis(
            module_route["module"],
            image_analysis,
            question=query,
            image_metadata=image_meta,
            plan=module_route,
        )

        answer = module_payload.get("narrative") or generate_analysis_summary(query, image_analysis)
        image_analysis["answer"] = answer
        image_analysis["module_route"] = _route_summary(module_route)
        image_analysis["module_result"] = module_payload

        q_lower = query.lower()
        if "ndvi" in q_lower or any(term in q_lower for term in ("vegetat", "forest", "tree", "canopy", "crop", "agriculture")):
            analysis_type = "VEGETATION"
        elif any(term in q_lower for term in ("water", "lake", "river", "flood", "reservoir")):
            analysis_type = "WATER_DETECTION"
        elif any(term in q_lower for term in ("built", "urban", "development", "impervious", "building")):
            analysis_type = "BUILT_UP_ANALYSIS"
        else:
            analysis_type = "GENERAL_QUERY"

        statistics = {
            "imageType": image_analysis["image_type"],
            "method": image_analysis["method"],
            "confidenceBasis": image_analysis["confidence_basis"],
            "totalPixels": image_analysis["total_pixels"],
            "validPixelCount": image_analysis["valid_pixel_count"],
            "classAvailability": image_analysis["class_availability"],
            "waterPercentage": image_analysis["class_percentages"]["water"],
            "landPercentage": (
                round(100.0 - image_analysis["class_percentages"]["water"], 2)
                if image_analysis["class_percentages"]["water"] is not None
                else None
            ),
            "vegetationPercentage": image_analysis["vegetation_percentage"],
            "builtUpPercentage": image_analysis["class_percentages"]["built_up"],
            "bareSoilPercentage": image_analysis["class_percentages"]["bare_land"],
            "otherPercentage": image_analysis["class_percentages"]["other"],
            "waterPixelCount": image_analysis["class_pixel_counts"]["water"],
            "vegetationPixelCount": image_analysis["class_pixel_counts"]["vegetation"],
            "builtUpPixelCount": image_analysis["class_pixel_counts"]["built_up"],
            "bareSoilPixelCount": image_analysis["class_pixel_counts"]["bare_land"],
            "isMultispectral": image_analysis["image_type"] == "multispectral",
            "pixelAnalysis": image_analysis,
        }
        for index_name, frontend_name in (
            ("ndvi", "meanNdvi"),
            ("ndwi", "meanNdwi"),
            ("mndwi", "meanMndwi"),
            ("ndbi", "meanNdbi"),
        ):
            measured_index = image_analysis["indices"].get(index_name)
            if measured_index:
                statistics[frontend_name] = round(measured_index["mean"], 4)
        if image_analysis["ndvi_available"]:
            statistics["meanIndex"] = round(image_analysis["indices"]["ndvi"]["mean"], 4)

        detections = []
        for class_name, region in image_analysis["regions_image_relative"].items():
            region_item = {
                "id": f"image-region-{class_name}",
                "label": f"Approximate {class_name.replace('_', ' ')} mask envelope",
                "category": {
                    "water": "water_body",
                    "vegetation": "vegetation",
                    "built_up": "building",
                }[class_name],
                "box_2d": [region["ymin"], region["xmin"], region["ymax"], region["xmax"]],
                "modality_evidence": image_analysis["method"],
            }
            detections.append(region_item)

        trace.append({
            "step": 2,
            "name": "Uploaded Raster Analysis",
            "action": (
                f"Measured {image_analysis['valid_pixel_count']} pixels from the uploaded "
                f"{image_analysis['image_type']} image using {image_analysis['method']}."
            ),
            "image_type": image_analysis["image_type"],
            "band_mapping": image_analysis["band_mapping"],
            "duration_ms": round((time.time() - t2_start) * 1000, 2),
        })

        single_image_result = {
            "session_id": str(uuid.uuid4()),
            "task": "SINGLE_IMAGE_VQA",
            "task_description": "Image-derived remote-sensing measurements",
            "query": query,
            "summary": answer,
            "direct_answer": answer,
            "module_route": _route_summary(module_route),
            "module_result": module_payload,
            "question_category": analysis_type,
            "suggested_followups": [
                "What is the water coverage?",
                "What is the vegetation coverage?",
                "What land-cover classes are present?",
            ],
            "models_executed": [],
            "agents_executed": ["ImageDecoder", "DeterministicImageAnalysis"],
            "tools_executed": ["raster_band_detection", "pixel_classification", "spectral_indices"],
            "statistics": statistics,
            "image_analysis": image_analysis,
            "spectral_indices": image_analysis["indices"],
            "detections": detections,
            "geojson_layers": {"type": "FeatureCollection", "features": []},
            "land_cover": {
                "class_percentages": image_analysis["class_percentages"],
                "method": image_analysis["method"],
            },
            "change_metrics": None,
            "cross_modal_metrics": None,
            "key_takeaways": [],
            "recommendations": [],
            "execution_trace": trace,
            "total_latency_ms": round((time.time() - start_time) * 1000, 2),
            "auditable_summary": {
                "selected_task": analysis_type,
                "specialist_models": [],
                "permitted_parameters": {},
                "input_verification": {
                    "image_type": image_analysis["image_type"],
                    "valid_pixel_count": image_analysis["valid_pixel_count"],
                    "band_mapping": image_analysis["band_mapping"],
                    "analysis_method": image_analysis["method"],
                },
                "total_processing_time_ms": round((time.time() - start_time) * 1000, 2),
            },
        }
        if not secondary_image:
            return single_image_result

        secondary_validation = satellite_validator.validate_image(secondary_image)
        if not secondary_validation.get("is_valid", True):
            message = (
                "The second image could not be verified as a supported remote-sensing image. "
                "No paired comparison was generated."
            )
            return {
                "success": False,
                "task": "INVALID_SECOND_IMAGE",
                "query": query,
                "summary": message,
                "direct_answer": message,
                "statistics": {},
                "detections": [],
                "recommendations": [],
                "execution_trace": trace,
                "total_latency_ms": round((time.time() - start_time) * 1000, 2),
            }

        secondary_analysis = analyze_satellite_image(secondary_image)
        primary_sensor = " ".join(str(primary_image.get(key) or "") for key in ("satellite", "sensor", "sensor_type")).lower()
        secondary_sensor = " ".join(str(secondary_image.get(key) or "") for key in ("satellite", "sensor", "sensor_type")).lower()
        primary_is_radar = any(term in primary_sensor for term in ("sar", "radar", "risat"))
        secondary_is_radar = any(term in secondary_sensor for term in ("sar", "radar", "risat"))
        same_analysis_basis = (
            image_analysis["image_type"] == secondary_analysis["image_type"]
            and primary_is_radar == secondary_is_radar
            and all(
                image_analysis["class_availability"].get(name, False)
                and secondary_analysis["class_availability"].get(name, False)
                for name in ("water", "vegetation", "built_up", "bare_land", "other")
            )
            and (
                image_analysis["image_type"] == "rgb"
                or (
                    set(image_analysis["band_mapping"]) == set(secondary_analysis["band_mapping"])
                    and image_analysis["water_index"] == secondary_analysis["water_index"]
                )
            )
        )
        categories = ("vegetation", "water", "built_up", "bare_land", "other")
        primary_percentages = image_analysis["class_percentages"]
        secondary_percentages = secondary_analysis["class_percentages"]
        coverage_deltas = (
            {
                name: round(secondary_percentages[name] - primary_percentages[name], 2)
                for name in categories
            }
            if same_analysis_basis
            else {}
        )

        # Route the pair question + selected sidebar module (bi-temporal aware).
        pair_route = route_analysis(
            question=query,
            selected_module=selected_module,
            analysis=image_analysis,
            image_metadata=image_meta,
        )
        pair_payload = run_module_analysis(
            pair_route["module"],
            image_analysis,
            question=query,
            image_metadata=image_meta,
            plan=pair_route,
            secondary_analysis=secondary_analysis,
            coverage_deltas=coverage_deltas,
        )
        pair_interpretation = generate_pair_analysis_summary(
            question=query,
            image_a={**image_analysis, "acquisition_date": primary_image.get("acquisition_date")},
            image_b={**secondary_analysis, "acquisition_date": secondary_image.get("acquisition_date")},
            coverage_deltas=coverage_deltas,
            compatible_basis=same_analysis_basis,
        )
        module_narrative = pair_payload.get("narrative") or ""
        comparison_answer = (
            f"{module_narrative}\n\n{pair_interpretation}"
            if module_narrative
            else pair_interpretation
        )

        single_image_result.update({
            "task": "IMAGE_COVERAGE_COMPARISON",
            "task_description": "Independent image measurements with a qualified coverage comparison",
            "summary": comparison_answer,
            "direct_answer": comparison_answer,
            "module_route": _route_summary(pair_route),
            "module_result": pair_payload,
            "question_category": "COVERAGE_COMPARISON",
            "comparison_image_analysis": secondary_analysis,
            "statistics": {
                **statistics,
                "comparisonImageType": secondary_analysis["image_type"],
                "coverageComparison": {
                    "compatible_analysis_basis": same_analysis_basis,
                    "difference_percentage_points": coverage_deltas,
                    "spatial_change_detection_performed": False,
                },
            },
        })
        image_analysis["coverage_comparison"] = {
            "compatible_analysis_basis": same_analysis_basis,
            "difference_percentage_points": coverage_deltas,
            "comparison_image_type": secondary_analysis["image_type"],
        }
        single_image_result["change_metrics"] = None
        return single_image_result

        p_format = primary_image.get("format", "GeoTIFF").upper()
        p_satellite = primary_image.get("satellite", "Sentinel-2")
        p_sensor = primary_image.get("sensor", "MSI")
        p_modality = primary_image.get("sensor_type", "OPTICAL_MULTISPECTRAL")
        p_res = primary_image.get("resolution_meters", 10.0)
        p_crs = primary_image.get("metadata", {}).get("crs", "EPSG:4326")

        approved_formats = ["GEOTIFF", "TIFF", "PNG", "JPEG", "JPG"]
        format_valid = any(p_format.endswith(fmt) for fmt in approved_formats)

        # Run Preprocessing Agent
        prep_result = preprocessing_agent.prepare_scene(primary_image)

        # Run GIS Agent to establish AOI and compute area
        default_bbox: Tuple[float, float, float, float] = (
            primary_image.get("bounds", {}).get("min_lon", 77.10),
            primary_image.get("bounds", {}).get("min_lat", 28.50),
            primary_image.get("bounds", {}).get("max_lon", 77.30),
            primary_image.get("bounds", {}).get("max_lat", 28.70)
        ) if primary_image.get("bounds") else (77.10, 28.50, 77.30, 28.70)

        gis_aoi = gis_agent.process_aoi(aoi_data=user_params.get("aoi"), default_bbox=default_bbox)
        aoi_area_sq_km = gis_aoi["aoi_area_sq_km"]

        compatibility_report = {
            "primary_image": {
                "id": primary_image.get("id"),
                "format": p_format,
                "format_valid": format_valid,
                "satellite": p_satellite,
                "sensor": p_sensor,
                "modality": p_modality,
                "resolution_meters": p_res,
                "crs": p_crs,
                "acquisition_date": primary_image.get("acquisition_date")
            },
            "preprocessing": prep_result["preprocessing_report"],
            "gis_spatial": {
                "aoi_area_sq_km": aoi_area_sq_km,
                "aoi_area_ha": gis_aoi["aoi_area_hectares"],
                "crs": gis_aoi["crs"]
            }
        }

        if secondary_image:
            s_format = secondary_image.get("format", "GeoTIFF").upper()
            s_res = secondary_image.get("resolution_meters", 10.0)
            s_crs = secondary_image.get("metadata", {}).get("crs", "EPSG:4326")
            compatibility_report["secondary_image"] = {
                "id": secondary_image.get("id"),
                "format": s_format,
                "satellite": secondary_image.get("satellite"),
                "sensor": secondary_image.get("sensor"),
                "modality": secondary_image.get("sensor_type", "SAR"),
                "resolution_meters": s_res,
                "crs": s_crs,
                "acquisition_date": secondary_image.get("acquisition_date")
            }
            compatibility_report["co_registration_status"] = "VERIFIED_ALIGNED (Sub-pixel affine registration valid)"
            compatibility_report["crs_aligned"] = (p_crs == s_crs)

        trace.append({
            "step": 2,
            "name": "Preprocessing & GIS Agents",
            "action": f"Completed ARD preprocessing (cloud mask, BOA scaling) and computed {aoi_area_sq_km} km² AOI",
            "compatibility_report": compatibility_report,
            "duration_ms": round((time.time() - t2_start) * 1000, 2)
        })

        # -------------------------------------------------------------
        # STEP 3: Agent & Model Registry Selection
        # -------------------------------------------------------------
        t3_start = time.time()
        selected_models: List[str] = []
        selected_agents: List[str] = ["QueryUnderstandingAgent", "PreprocessingAgent", "GISAgent", "ExplanationAgent"]
        selected_tools: List[str] = ["geo_input_validator"]

        if task == "CROSS_MODAL_PAIR_ANALYSIS":
            selected_models = ["Optical-SAR-Fusion-Net", "RS-BigEarthNet-VLM", "Radiometric-Spectral-Engine"]
            selected_tools.extend(["polarimetric_sar_analyzer", "spatial_bounding_filter"])
            selected_agents.append("RemoteSensingVisionAgent")
        elif task == "BITEMPORAL_CHANGE_ANALYSIS":
            selected_models = ["CDVQA-BiTemporal-Net", "RS-BigEarthNet-VLM", "Radiometric-Spectral-Engine"]
            selected_tools.extend(["bi_temporal_differencing", "spatial_bounding_filter"])
            selected_agents.extend(["ChangeDetectionAgent", "RemoteSensingVisionAgent"])
        elif task == "TEXT_GUIDED_REGION_GROUNDING":
            selected_models = ["RS-Grounding-Net", "RS-BigEarthNet-VLM", "Radiometric-Spectral-Engine"]
            selected_tools.append("spatial_bounding_filter")
            selected_agents.append("RemoteSensingVisionAgent")
        elif task == "SCENE_CAPTIONING":
            selected_models = ["VRSBench-Captioner", "RS-BigEarthNet-VLM", "Radiometric-Spectral-Engine"]
            selected_agents.append("RemoteSensingVisionAgent")
        else: # SINGLE_IMAGE_VQA
            selected_models = ["RSVQA-Specialist", "RS-BigEarthNet-VLM", "Radiometric-Spectral-Engine"]
            selected_agents.append("RemoteSensingVisionAgent")
            if extracted["cues"]["is_grounding"]:
                selected_models.append("RS-Grounding-Net")
                selected_tools.append("spatial_bounding_filter")

        trace.append({
            "step": 3,
            "name": "Analysis Planner & LangGraph Registry Routing",
            "action": f"Selected agents: {', '.join(selected_agents)}; Models: {', '.join(selected_models)}",
            "orchestration_engine": "LangGraph StateGraph Workflow",
            "selected_agents": selected_agents,
            "selected_models": [MODEL_REGISTRY.get(m) for m in selected_models if m in MODEL_REGISTRY],
            "selected_tools": [TOOL_REGISTRY.get(t) for t in selected_tools if t in TOOL_REGISTRY],
            "duration_ms": round((time.time() - t3_start) * 1000, 2)
        })

        # -------------------------------------------------------------
        # STEP 4: Parameter Configuration & Policy Enforcement
        # -------------------------------------------------------------
        t4_start = time.time()
        configured_params = {
            "confidence_threshold": float(user_params.get("confidence_threshold", 0.85)),
            "nms_iou_threshold": float(user_params.get("nms_iou_threshold", 0.45)),
            "spectral_indices": ["NDVI", "NDWI", "NDBI", "SAVI"],
            "speckle_filtering": user_params.get("speckle_filtering", "Enhanced Lee 5x5"),
            "polarization_channels": user_params.get("polarization", ["VV", "VH"]),
            "geotiff_strict_georeferencing": True,
        }

        trace.append({
            "step": 4,
            "name": "Parameter Configuration & Policy Enforcement",
            "action": "Applied strictly permitted parameter constraints to pipeline",
            "configured_parameters": configured_params,
            "duration_ms": round((time.time() - t4_start) * 1000, 2)
        })

        # -------------------------------------------------------------
        # STEP 5: Remote Sensing Processing, Vision & Explanation Agents
        # -------------------------------------------------------------
        t5_start = time.time()

        # Compute Core Spectral Indices
        ndvi_res = ndvi_processor.analyze_scene(primary_image, aoi_area_sq_km)
        ndwi_res = ndwi_processor.analyze_scene(primary_image, aoi_area_sq_km)
        ndbi_res = ndbi_processor.analyze_scene(primary_image, aoi_area_sq_km)
        savi_nbr_res = savi_nbr_processor.analyze_burn_severity(primary_image, aoi_area_sq_km)

        # Baseline spectral statistics
        spectral_stats = self.spectral_engine.compute_indices(primary_image)

        # Execute BigEarthNet adapted representation
        land_cover_rep = self.bigearthnet.extract_multispectral_features(primary_image, query)

        result_summary = ""
        detections: List[Dict[str, Any]] = []
        change_metrics = None
        cross_modal_metrics = None
        confidence = 0.93

        if task == "CROSS_MODAL_PAIR_ANALYSIS":
            sar_img = secondary_image or {
                "id": "synthetic-sar-pair",
                "satellite": "RISAT-1A / EOS-04",
                "sensor": "C-Band SAR Hybrid/Dual Pol",
                "polarization": "VV / VH Dual-Pol",
                "resolution_meters": primary_image.get("resolution_meters", 10.0),
                "acquisition_date": primary_image.get("acquisition_date")
            }
            res = self.optical_sar_fusion.joint_inference(query, primary_image, sar_img)
            result_summary = res["summary"]
            detections = res["detections"]
            cross_modal_metrics = res
            confidence = res["confidence"]

        elif task == "BITEMPORAL_CHANGE_ANALYSIS":
            target_t2 = secondary_image or {
                "id": "t2-followup",
                "satellite": "Sentinel-2B",
                "sensor": "MSI",
                "resolution_meters": 10.0,
                "acquisition_date": f"{extracted.get('end_year', 2025)}-06-15"
            }
            change_report = change_agent.compare_scenes(query, primary_image, target_t2, aoi_area_sq_km)
            result_summary = change_report["summary"]
            change_metrics = {
                **change_report["quantitative_metrics"],
                "land_improvement": change_report.get("land_improvement"),
                "transitions": change_report.get("transitions"),
                "time_span": change_report.get("time_span")
            }
            confidence = change_report["confidence"]

            for h in change_report.get("hotspots", []):
                detections.append({
                    "id": h["id"],
                    "label": f"{h['change_type']}: {h['name']}",
                    "category": "CHANGE_HOTSPOT",
                    "confidence": h["confidence"],
                    "area_sq_m": h["area_sq_km"] * 1000000.0,
                    "box_2d": h["box_2d"]
                })

        elif task == "TEXT_GUIDED_REGION_GROUNDING":
            res = self.grounding.ground_text_in_scene(query, primary_image)
            detections = res["detections"]
            confidence = res["mean_iou_confidence"]
            result_summary = (
                f"Spatial grounding completed using RS-Grounding-Net. Identified {len(detections)} discrete "
                f"spatial target region(s) matching expression '{query}' with mean IoU confidence of {confidence * 100:.1f}%. "
                f"Bounding boundaries have been projected onto WGS-84 coordinate space."
            )

        elif task == "SCENE_CAPTIONING":
            res = self.rsvqa_vrsbench.generate_caption(primary_image, land_cover_rep)
            result_summary = res["caption"]
            confidence = res["confidence"]

        else: # SINGLE_IMAGE_VQA
            res = self.rsvqa_vrsbench.answer_question(query, primary_image, spectral_stats)
            result_summary = res["answer"]
            confidence = res["confidence"]
            if extracted["cues"]["is_grounding"] or extracted["cues"]["is_water"] or extracted["cues"]["is_urban"] or any(w in query.lower() for w in ["detect", "find", "locate", "where", "highlight"]):
                g_res = self.grounding.ground_text_in_scene(query, primary_image)
                detections = g_res["detections"]

        # Synthesize Explanation via ExplanationAgent
        explanation = explanation_agent.generate_explanation(
            query=query,
            task_type=task,
            analysis_data={
                "statistics": ndvi_res["statistics"] if extracted["cues"]["is_vegetation"] else (
                    ndwi_res["statistics"] if extracted["cues"]["is_water"] else ndbi_res["statistics"]
                ),
                "metrics": change_metrics or {}
            },
            location=extracted["location"]
        )

        if not result_summary:
            result_summary = explanation["summary"]

        direct_answer = result_summary
        suggested_followups = [
            "What is the dominant land-cover in this image?",
            "Are there any water bodies or rivers?",
            "Identify all buildings and infrastructure",
        ]
        if 'res' in locals() and isinstance(res, dict):
            if "direct_answer" in res:
                direct_answer = res["direct_answer"]
            if "suggested_followups" in res and res["suggested_followups"]:
                suggested_followups = res["suggested_followups"]

        recommendations = explanation["recommendations"]

        # Generate GeoJSON Vector Layers via GIS Agent
        geojson_vectors = gis_agent.detections_to_geojson(detections, default_bbox)

        trace.append({
            "step": 5,
            "name": "Specialist Workflow Execution & Explanation Agent",
            "action": f"Executed multi-agent analysis with {len(selected_models)} models; generated natural-language explanation",
            "evidence_count": len(detections),
            "confidence_score": confidence,
            "duration_ms": round((time.time() - t5_start) * 1000, 2)
        })

        total_latency_ms = round((time.time() - start_time) * 1000, 2)

        # Execute Unified ML/DL Pipeline (GeoRSCLIP, ViT, SAM, RSVQA, Rasterio/GDAL/GeoPandas)
        ml_eval = rs_ml_engine.analyze_remote_sensing_scene(query, primary_image, spectral_stats)

        return {
            "session_id": str(uuid.uuid4()),
            "task": task,
            "task_description": task_desc,
            "query": query,
            "summary": result_summary,
            "direct_answer": direct_answer,
            "suggested_followups": suggested_followups,
            "confidence": confidence,
            "models_executed": selected_models,
            "agents_executed": selected_agents,
            "tools_executed": selected_tools,
            "ml_evaluation": ml_eval,
            "statistics": spectral_stats,
            "spectral_indices": {
                "ndvi": ndvi_res,
                "ndwi": ndwi_res,
                "ndbi": ndbi_res,
                "savi_nbr": savi_nbr_res
            },
            "detections": detections,
            "geojson_layers": geojson_vectors,
            "land_cover": land_cover_rep,
            "change_metrics": change_metrics,
            "cross_modal_metrics": cross_modal_metrics,
            "key_takeaways": explanation["key_takeaways"],
            "recommendations": recommendations,
            "execution_trace": trace,
            "total_latency_ms": total_latency_ms,
            "auditable_summary": {
                "selected_task": task,
                "agents_executed": selected_agents,
                "specialist_models": selected_models,
                "ml_frameworks": [
                    "GeoRSCLIP (Vision-Language Pre-training)",
                    "ViT (Vision Transformer Patch Representation)",
                    "RSVQA / VQA Specialist",
                    "SAM (Segment Anything Model)",
                    "VLM / OpenRouter Multi-Model LLM"
                ],
                "libraries_utilized": [
                    "PyTorch", "Hugging Face Transformers", "OpenCV", "NumPy", "Rasterio", "GDAL", "GeoPandas"
                ],
                "permitted_parameters": configured_params,
                "input_verification": compatibility_report,
                "total_processing_time_ms": total_latency_ms
            }
        }

agentic_orchestrator = AgenticOrchestrator()
