"""
SatQuery AI - Evaluation Package
"""
from .isro_sac_benchmarks import EVALUATION_CRITERIA_TABLE, calculate_normalized_benchmark_score
from .benchmark_registry import BENCHMARK_CATALOG
from .metrics import calculate_top1_accuracy, calculate_bleu, calculate_iou, calculate_f1_score, calculate_cohen_kappa
from .evaluator import evaluator, BenchmarkEvaluator
from .prediction_export import export_prediction_to_json, export_detections_to_geojson
from .bigearthnet_adapter import BigEarthNetAdapter
from .vrsbench_adapter import VRSBenchAdapter
from .rsvqa_adapter import RSVQAAdapter
from .cdvqa_adapter import CDVQAAdapter
from .isro_sac_adapter import ISROSACAdapter

__all__ = [
    "EVALUATION_CRITERIA_TABLE",
    "calculate_normalized_benchmark_score",
    "BENCHMARK_CATALOG",
    "calculate_top1_accuracy",
    "calculate_bleu",
    "calculate_iou",
    "calculate_f1_score",
    "calculate_cohen_kappa",
    "evaluator",
    "BenchmarkEvaluator",
    "export_prediction_to_json",
    "export_detections_to_geojson",
    "BigEarthNetAdapter",
    "VRSBenchAdapter",
    "RSVQAAdapter",
    "CDVQAAdapter",
    "ISROSACAdapter",
]
