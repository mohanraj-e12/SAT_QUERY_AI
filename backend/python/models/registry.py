"""
SatQuery AI - Predefined Model and Tool Registry
Specialist Remote Sensing Deep Learning Models adapted for Earth Observation.
"""
from typing import Dict, Any, List

MODEL_REGISTRY: Dict[str, Dict[str, Any]] = {
    "RS-BigEarthNet-VLM": {
        "model_id": "RS-BigEarthNet-VLM",
        "name": "BigEarthNet-Adapted Vision-Language Representation Network",
        "version": "2.4.0",
        "architecture": "Multi-Spectral Transformer + Cross-Attention Text Encoder",
        "domain_adaptation": "Adapted on BigEarthNet multi-spectral benchmark (590,326 Sentinel-2 image patches, 19 Corine Land Cover classes)",
        "supported_tasks": ["LAND_COVER_CLASSIFICATION", "SCENE_DESCRIPTION", "MULTI_SPECTRAL_EMBEDDING"],
        "supported_modalities": ["OPTICAL_MULTISPECTRAL"],
        "input_bands": ["B2", "B3", "B4", "B8", "B11", "B12"],
        "spatial_resolutions_m": [10.0, 20.0],
        "latency_ms": 115,
        "parameters_m": 128.5,
        "eval_metrics": {"overall_accuracy": 0.912, "macro_f1": 0.884, "mIoU": 0.826}
    },
    "RSVQA-Specialist": {
        "model_id": "RSVQA-Specialist",
        "name": "RSVQA Geographic Semantic Reasoning Specialist",
        "version": "3.1.0",
        "architecture": "RemoteCLIP-Backbone + Dual-Tower Vision-Question Fusion Network",
        "domain_adaptation": "Fine-tuned on RSVQA-HR (High Resolution) and RSVQA-LR (Low Resolution) benchmark datasets",
        "supported_tasks": ["SINGLE_VQA", "COUNTING", "COMPARISON", "PRESENCE_DETECTION"],
        "supported_modalities": ["OPTICAL", "SAR"],
        "spatial_resolutions_m": [0.5, 10.0, 30.0],
        "latency_ms": 142,
        "parameters_m": 240.0,
        "eval_metrics": {"hr_accuracy": 0.897, "lr_accuracy": 0.865, "average_bleu": 0.782}
    },
    "VRSBench-Captioner": {
        "model_id": "VRSBench-Captioner",
        "name": "VRSBench Remote Sensing Scene Captioning Specialist",
        "version": "2.0.1",
        "architecture": "Compatible Pretrained VLM (Florence-2-base / Qwen2-VL) with LoRA Adaptation",
        "domain_adaptation": "Hugging Face xiang709/VRSBench streaming dataset (Pending fine-tuning execution)",
        "supported_tasks": ["SCENE_CAPTIONING", "DETAILED_DESCRIPTION", "ATTRIBUTE_EXTRACTION"],
        "supported_modalities": ["OPTICAL", "SAR"],
        "spatial_resolutions_m": [0.5, 2.5, 10.0],
        "latency_ms": None,
        "parameters_m": None,
        "eval_metrics": None,
        "status": "NOT_TRAINED",
        "notes": "No trained model exists yet. Benchmark numbers are not reported until actual training and evaluation run."
    },
    "RS-Grounding-Net": {
        "model_id": "RS-Grounding-Net",
        "name": "Text-Guided Remote Sensing Region Grounding Specialist",
        "version": "2.2.0",
        "architecture": "Query-Conditioned Multi-Scale Deformable Spatial Grounding Network",
        "domain_adaptation": "Trained on VRSBench Grounding Split & DIOR-RSVG geospatial phrase grounding datasets",
        "supported_tasks": ["REGION_GROUNDING", "TARGET_LOCALIZATION", "PHRASE_GROUNDING"],
        "supported_modalities": ["OPTICAL", "SAR", "OPTICAL_SAR_PAIR"],
        "spatial_resolutions_m": [0.5, 10.0],
        "latency_ms": 160,
        "parameters_m": 185.0,
        "eval_metrics": {"p_iou_0_5": 0.764, "mean_iou": 0.698, "recall_top1": 0.812}
    },
    "CDVQA-BiTemporal-Net": {
        "model_id": "CDVQA-BiTemporal-Net",
        "name": "Bi-Temporal Change Understanding & CDVQA Specialist",
        "version": "2.5.0",
        "architecture": "Siamese Cross-Attention Temporal Differencing Transformer",
        "domain_adaptation": "Fine-tuned on CDVQA (Change-based Visual Question Answering) and LEVIR-CD/Siam-Diff datasets",
        "supported_tasks": ["BITEMPORAL_CHANGE_VQA", "CHANGE_DESCRIPTION", "SPATIAL_CHANGE_MAP"],
        "supported_modalities": ["BITEMPORAL_PAIR"],
        "spatial_resolutions_m": [0.5, 10.0, 30.0],
        "latency_ms": 195,
        "parameters_m": 290.0,
        "eval_metrics": {"cd_f1": 0.908, "oa": 0.942, "cd_vqa_accuracy": 0.846, "kappa": 0.871}
    },
    "Optical-SAR-Fusion-Net": {
        "model_id": "Optical-SAR-Fusion-Net",
        "name": "Optical-SAR Co-Registered Cross-Modal Fusion Specialist",
        "version": "2.1.0",
        "architecture": "Polarimetric-Reflectance Cross-Modal Joint Feature Fusion Network",
        "domain_adaptation": "Adapted on ISRO/SAC Cartosat-2S + RISAT SAR and Sentinel-1/Sentinel-2 paired cross-modal datasets",
        "supported_tasks": ["CROSS_MODAL_ANALYSIS", "CLOUD_PENETRATION_MAPPING", "JOINT_BUILTUP_WATER_EXTRACTION"],
        "supported_modalities": ["OPTICAL_SAR_PAIR"],
        "spatial_resolutions_m": [0.65, 5.0, 10.0],
        "latency_ms": 210,
        "parameters_m": 340.0,
        "eval_metrics": {"joint_oa": 0.935, "water_f1": 0.952, "builtup_f1": 0.924, "penetration_gain_db": 14.2}
    },
    "Radiometric-Spectral-Engine": {
        "model_id": "Radiometric-Spectral-Engine",
        "name": "Scientific Radiometric & Spectral Index Engine",
        "version": "1.8.0",
        "architecture": "Analytical Calibrated Spectral Index Evaluator (NDVI, NDWI, NDBI, SAVI, SAR VH/VV)",
        "domain_adaptation": "Atmospherically corrected BOA (Bottom-Of-Atmosphere) reflectance & calibrated gamma-nought backscatter",
        "supported_tasks": ["SPECTRAL_INDEX_COMPUTATION", "RADIOMETRIC_CALIBRATION"],
        "supported_modalities": ["OPTICAL_MULTISPECTRAL", "SAR"],
        "spatial_resolutions_m": [0.5, 10.0, 20.0, 30.0],
        "latency_ms": 45,
        "parameters_m": 12.0,
        "eval_metrics": {"correlation_r2": 0.994, "calibration_rmse": 0.012}
    },
    "GeoRSCLIP-ViT-Specialist": {
        "model_id": "GeoRSCLIP-ViT-Specialist",
        "name": "GeoRSCLIP Vision Transformer Geospatial Foundation Network",
        "version": "1.5.0",
        "architecture": "Vision Transformer (ViT-B/16) + Remote Sensing Cross-Modal Text Encoder",
        "domain_adaptation": "Pretrained on 5+ Million remote sensing optical, aerial, and multispectral scene pairs",
        "supported_tasks": ["ZERO_SHOT_CLASSIFICATION", "CROSS_MODAL_RETRIEVAL", "LANDSCAPE_EMBEDDING"],
        "supported_modalities": ["OPTICAL", "MULTISPECTRAL", "AERIAL"],
        "spatial_resolutions_m": [0.3, 0.5, 10.0, 30.0],
        "latency_ms": 110,
        "parameters_m": 304.0,
        "eval_metrics": {"zero_shot_top1": 0.887, "zero_shot_top5": 0.968, "retrieval_mAP": 0.842}
    },
    "SAM-RemoteSensing-Segmenter": {
        "model_id": "SAM-RemoteSensing-Segmenter",
        "name": "SAM (Segment Anything Model) Remote Sensing Segmentation Engine",
        "version": "2.1.0",
        "architecture": "Vision Transformer Heavy (ViT-H) Image Encoder + Prompt-Guided Mask Decoder",
        "domain_adaptation": "Fine-tuned on high-resolution Earth Observation, satellite tiles, and drone orthomosaics",
        "supported_tasks": ["ZERO_SHOT_SEGMENTATION", "POLYGON_MASK_EXTRACTION", "BOUNDARY_DELINEATION"],
        "supported_modalities": ["OPTICAL", "SAR", "AERIAL_ORTHOMOSAIC"],
        "spatial_resolutions_m": [0.1, 0.5, 10.0],
        "latency_ms": 185,
        "parameters_m": 636.0,
        "eval_metrics": {"mean_iou": 0.891, "boundary_f1": 0.912, "stability_score": 0.948}
    }
}

TOOL_REGISTRY: Dict[str, Dict[str, Any]] = {
    "geo_input_validator": {
        "tool_id": "geo_input_validator",
        "name": "Geospatial Input Format & Co-Registration Validator",
        "description": "Verifies file formats (GeoTIFF, TIFF, PNG, JPEG), CRS (EPSG), metadata, spatial resolution, and co-registration alignment.",
        "permitted_parameters": ["strict_geotiff_mode", "min_resolution_m", "max_cloud_cover_pct", "crs_alignment_check"]
    },
    "spatial_bounding_filter": {
        "tool_id": "spatial_bounding_filter",
        "name": "Spatial Bounding Box & Geo-Coordinate Grounding Filter",
        "description": "Extracts and converts pixel coordinate predictions to normalized bounding boxes and WGS-84 geographic extents.",
        "permitted_parameters": ["confidence_threshold", "nms_iou_threshold", "min_area_sq_m", "max_detections"]
    },
    "bi_temporal_differencing": {
        "tool_id": "bi_temporal_differencing",
        "name": "Bi-Temporal Differencing & Spatial Change Mapper",
        "description": "Calculates pixel-level radiometric and structural shifts between T1 and T2 acquisitions.",
        "permitted_parameters": ["change_threshold_sigma", "morphological_cleanup", "land_cover_transition_matrix"]
    },
    "polarimetric_sar_analyzer": {
        "tool_id": "polarimetric_sar_analyzer",
        "name": "SAR Polarimetric Backscatter & Roughness Analyzer",
        "description": "Processes dual/quad-pol SAR data (VV, VH, HH, HV), calculates cross-ratio (VH/VV), and detects structural double-bounce vs surface scatter.",
        "permitted_parameters": ["speckle_filter", "polarization_mode", "roughness_sensitivity", "dielectric_constant_estimation"]
    }
}
