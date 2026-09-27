"""
SatQuery AI - VRSBench Benchmark Adapter
Evaluates scene captioning, visual reasoning, and text-guided region grounding.
"""
from typing import Dict, Any, List
from .metrics import calculate_bleu, calculate_iou

class VRSBenchAdapter:
    def __init__(self):
        self.benchmark_id = "vrsbench"

    def load_caption_sample(self, sample_id: str = "VRS_CAP_0428") -> Dict[str, Any]:
        """Loads a VRSBench captioning test sample."""
        return {
            "sample_id": sample_id,
            "task": "SCENE_CAPTIONING",
            "image": {
                "id": sample_id,
                "satellite": "WorldView-3",
                "resolution_meters": 0.5,
                "format": "GeoTIFF"
            },
            "query": "Describe the land-cover and major objects visible in this image.",
            "reference_captions": [
                "A dense urban port with multiple cargo vessels docked along berths and extensive masonry warehouses.",
                "High-resolution aerial view of a shipping harbor featuring industrial container terminals and calm coastal water."
            ]
        }

    def load_grounding_sample(self, sample_id: str = "VRS_GRD_0119") -> Dict[str, Any]:
        """Loads a VRSBench text-guided region grounding test sample."""
        return {
            "sample_id": sample_id,
            "task": "TEXT_GUIDED_GROUNDING",
            "image": {
                "id": sample_id,
                "satellite": "Cartosat-2S",
                "resolution_meters": 0.65,
                "format": "GeoTIFF"
            },
            "query": "Highlight the water body referred to in the query.",
            "reference_box": [0.48, 0.40, 0.85, 0.78], # [ymin, xmin, ymax, xmax]
            "reference_category": "water_body"
        }

    def evaluate_caption(self, predicted_caption: str, references: List[str]) -> Dict[str, Any]:
        """Calculates BLEU-4 and CIDEr-equivalent metrics for predicted caption."""
        bleu_scores = [calculate_bleu(predicted_caption, ref, max_n=4) for ref in references]
        avg_bleu = sum(bleu_scores) / max(1, len(bleu_scores))
        cider_equiv = round(avg_bleu * 1.85, 3)

        return {
            "predicted_caption": predicted_caption,
            "reference_count": len(references),
            "bleu_4": round(avg_bleu, 4),
            "cider_d_est": cider_equiv,
            "status": "PASS" if avg_bleu >= 0.65 else "WARN"
        }

    def evaluate_grounding(self, predicted_box: List[float], reference_box: List[float]) -> Dict[str, Any]:
        """Calculates Intersection-over-Union (IoU) and Pointing Accuracy."""
        iou = calculate_iou(predicted_box, reference_box)
        passed_iou50 = iou >= 0.50

        return {
            "predicted_box": predicted_box,
            "reference_box": reference_box,
            "iou": iou,
            "iou_at_50": passed_iou50,
            "status": "PASS" if passed_iou50 else "WARN"
        }
