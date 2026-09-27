"""
SatQuery AI - Benchmark Registry
Catalog of standard remote-sensing benchmarks, evaluation splits, and supported tasks.
"""
from typing import Dict, Any

BENCHMARK_CATALOG: Dict[str, Dict[str, Any]] = {
    "bigearthnet": {
        "id": "bigearthnet",
        "name": "BigEarthNet-S2",
        "full_name": "BigEarthNet Multispectral Benchmark (Sentinel-2)",
        "task": "Multispectral Vision-Language Adaptation & Land Cover Classification",
        "modalities": ["OPTICAL_MULTISPECTRAL"],
        "bands": ["B2", "B3", "B4", "B8", "B11", "B12"],
        "classes": 19,
        "test_splits": ["test_10k_subset", "official_eval_split"],
        "official_metrics": ["Macro F1", "Micro F1", "mAP", "Average Loss"],
        "target_performance": {"macro_f1": 0.88, "mAP": 0.91},
        "citation": "Sumbul et al., 'BigEarthNet: A Large-Scale Benchmark Archive for Remote Sensing Image Understanding', IGARSS 2019."
    },
    "vrsbench": {
        "id": "vrsbench",
        "name": "VRSBench",
        "full_name": "Visual Remote Sensing Benchmark for Captioning & Grounding",
        "task": "Scene Captioning, Visual Reasoning & Text-Guided Grounding",
        "modalities": ["OPTICAL_HIGH_RES", "SAR"],
        "test_splits": ["vrsbench_val", "vrsbench_test_core"],
        "official_metrics": ["BLEU-4", "CIDEr-D", "ROUGE-L", "IoU@0.5", "mIoU"],
        "target_performance": {"cider": 1.38, "miou": 0.69},
        "citation": "VRSBench Remote-Sensing Vision-Language Benchmark Consortium, 2024."
    },
    "rsvqa": {
        "id": "rsvqa",
        "name": "RSVQA",
        "full_name": "Remote Sensing Visual Question Answering (HR & LR)",
        "task": "Single-Image Visual Question Answering",
        "modalities": ["OPTICAL_MULTISPECTRAL", "AERIAL_RGB"],
        "test_splits": ["rsvqa_hr_test", "rsvqa_lr_test"],
        "official_metrics": ["Overall Accuracy (OA)", "Average BLEU", "Category F1"],
        "target_performance": {"overall_accuracy": 0.902, "bleu": 0.78},
        "citation": "Lobry et al., 'RSVQA: Visual Question Answering for Remote Sensing Data', IEEE TGRS 2020."
    },
    "cdvqa": {
        "id": "cdvqa",
        "name": "CDVQA",
        "full_name": "Change Detection Visual Question Answering",
        "task": "Bi-Temporal Change Analysis & Change-Based VQA",
        "modalities": ["BITEMPORAL_OPTICAL"],
        "test_splits": ["cdvqa_test_split", "levir_cd_eval"],
        "official_metrics": ["CD-VQA Accuracy", "Change F1", "Cohen's Kappa", "mIoU"],
        "target_performance": {"f1": 0.895, "accuracy": 0.862},
        "citation": "Yuan et al., 'CDVQA: Change Detection Visual Question Answering in Remote Sensing', IEEE TGRS 2023."
    },
    "isro_sac": {
        "id": "isro_sac",
        "name": "ISRO/SAC Evaluation Suite",
        "full_name": "ISRO Space Applications Centre Multimodal Benchmark",
        "task": "Co-Registered Optical-SAR Joint Reasoning (Cartosat-2S + RISAT SAR)",
        "modalities": ["OPTICAL_SAR_PAIR"],
        "missions": ["Cartosat-2S (0.65m Optical)", "RISAT-1A (1.0m C-Band SAR Dual-Pol)"],
        "test_splits": ["blind_eval_cartosat_risat_pair", "subpixel_coregistered_eval"],
        "official_metrics": ["Joint mIoU", "Built-up F1", "Water F1", "Cloud Penetration Gain (dB)", "Trace Compliance"],
        "target_performance": {"joint_miou": 0.79, "trace_compliance": 1.0},
        "citation": "ISRO/SAC Remote Sensing Vision-Language Benchmark Specification, 2024."
    }
}
