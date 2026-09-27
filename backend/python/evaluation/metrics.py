"""
SatQuery AI - Remote Sensing Benchmark Metrics Suite
Standardized calculation of evaluation metrics across RSVQA, VRSBench, CDVQA, BigEarthNet, and ISRO/SAC.
"""
from typing import List, Dict, Any, Union
import math

def calculate_top1_accuracy(predictions: List[str], ground_truths: List[str]) -> float:
    """Calculates Top-1 exact or normalized text match accuracy."""
    if not predictions or not ground_truths:
        return 0.0
    correct = 0
    for p, g in zip(predictions, ground_truths):
        p_clean = str(p).strip().lower()
        g_clean = str(g).strip().lower()
        if p_clean == g_clean or g_clean in p_clean or p_clean in g_clean:
            correct += 1
    return round(correct / len(predictions), 4)

def calculate_bleu(prediction: str, reference: str, max_n: int = 4) -> float:
    """Computes simplified smoothed BLEU score for remote-sensing captioning."""
    pred_tokens = prediction.strip().lower().split()
    ref_tokens = reference.strip().lower().split()
    if not pred_tokens or not ref_tokens:
        return 0.0

    # Brevity penalty
    bp = 1.0 if len(pred_tokens) > len(ref_tokens) else math.exp(1.0 - (len(ref_tokens) / max(1, len(pred_tokens))))
    precisions = []
    for n in range(1, max_n + 1):
        if len(pred_tokens) < n or len(ref_tokens) < n:
            precisions.append(0.5)
            continue
        pred_ngrams = [tuple(pred_tokens[i:i+n]) for i in range(len(pred_tokens)-n+1)]
        ref_ngrams = [tuple(ref_tokens[i:i+n]) for i in range(len(ref_tokens)-n+1)]
        matches = sum(1 for ng in pred_ngrams if ng in ref_ngrams)
        precisions.append((matches + 1e-6) / (len(pred_ngrams) + 1e-6))

    geom_mean = math.exp(sum(math.log(p) for p in precisions) / len(precisions))
    return round(bp * geom_mean, 4)

def calculate_iou(box_a: List[float], box_b: List[float]) -> float:
    """
    Computes Intersection over Union (IoU) for normalized boxes [ymin, xmin, ymax, xmax].
    """
    ymin_a, xmin_a, ymax_a, xmax_a = box_a
    ymin_b, xmin_b, ymax_b, xmax_b = box_b

    inter_ymin = max(ymin_a, ymin_b)
    inter_xmin = max(xmin_a, xmin_b)
    inter_ymax = min(ymax_a, ymax_b)
    inter_xmax = min(xmax_a, xmax_b)

    inter_h = max(0.0, inter_ymax - inter_ymin)
    inter_w = max(0.0, inter_xmax - inter_xmin)
    inter_area = inter_h * inter_w

    area_a = max(0.0, ymax_a - ymin_a) * max(0.0, xmax_a - xmin_a)
    area_b = max(0.0, ymax_b - ymin_b) * max(0.0, xmax_b - xmin_b)
    union_area = area_a + area_b - inter_area

    if union_area <= 0:
        return 0.0
    return round(inter_area / union_area, 4)

def calculate_f1_score(tp: int, fp: int, fn: int) -> float:
    """Standard F1-Score calculation."""
    precision = tp / max(1, tp + fp)
    recall = tp / max(1, tp + fn)
    if precision + recall == 0:
        return 0.0
    return round(2 * (precision * recall) / (precision + recall), 4)

def calculate_cohen_kappa(contingency: Dict[str, int]) -> float:
    """Computes Cohen's Kappa coefficient for binary/multiclass change detection."""
    tp = contingency.get("tp", 0)
    tn = contingency.get("tn", 0)
    fp = contingency.get("fp", 0)
    fn = contingency.get("fn", 0)
    total = max(1, tp + tn + fp + fn)

    po = (tp + tn) / total
    pe = (((tp + fp) * (tp + fn)) + ((fn + tn) * (fp + tn))) / (total * total)
    if (1.0 - pe) == 0:
        return 1.0
    kappa = (po - pe) / (1.0 - pe)
    return round(kappa, 4)
