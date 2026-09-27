from .segmentation import segment_image, SUPPORTED_SEGMENTATION_TASKS
from .classification import classify_scene
from .object_detection import detect_objects
from .statistics import compute_analysis_statistics

__all__ = [
    "segment_image",
    "SUPPORTED_SEGMENTATION_TASKS",
    "classify_scene",
    "detect_objects",
    "compute_analysis_statistics",
]
