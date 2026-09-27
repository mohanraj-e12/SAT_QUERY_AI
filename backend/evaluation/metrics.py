"""
SatQueryAI - Evaluation Metrics Module
Computes multilabel classification metrics, precision, recall, F1, VQA accuracy,
Expected Calibration Error (ECE), and Retrieval Recall@K.
"""

import math
from typing import List, Dict, Any, Set

def compute_multilabel_f1(predictions: List[Set[str]], ground_truths: List[Set[str]]) -> Dict[str, float]:
    """
    Computes Micro and Macro F1 across multi-label test sets.
    """
    if not predictions or not ground_truths or len(predictions) != len(ground_truths):
        return {"micro_f1": 0.0, "macro_f1": 0.0, "precision": 0.0, "recall": 0.0}

    total_tp = 0
    total_fp = 0
    total_fn = 0

    sample_f1s = []

    for pred_set, gt_set in zip(predictions, ground_truths):
        tp = len(pred_set.intersection(gt_set))
        fp = len(pred_set - gt_set)
        fn = len(gt_set - pred_set)

        total_tp += tp
        total_fp += fp
        total_fn += fn

        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0
        sample_f1s.append(f1)

    micro_prec = total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0.0
    micro_rec = total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0.0
    micro_f1 = (2 * micro_prec * micro_rec) / (micro_prec + micro_rec) if (micro_prec + micro_rec) > 0 else 0.0
    macro_f1 = sum(sample_f1s) / len(sample_f1s) if sample_f1s else 0.0

    return {
        "micro_precision": round(micro_prec, 4),
        "micro_recall": round(micro_rec, 4),
        "micro_f1": round(micro_f1, 4),
        "macro_f1": round(macro_f1, 4),
    }

def compute_vqa_accuracy(predicted_answers: List[str], ground_truth_answers: List[str]) -> float:
    """
    Calculates semantic match accuracy on VQA answers.
    """
    if not predicted_answers or not ground_truth_answers:
        return 0.0

    correct = 0
    for pred, gt in zip(predicted_answers, ground_truth_answers):
        p_norm = pred.lower().replace(".", "").replace(",", "")
        g_norm = gt.lower().replace(".", "").replace(",", "")

        # Check key semantic overlap
        g_words = [w for w in g_norm.split() if len(w) > 3]
        overlap = sum(1 for w in g_words if w in p_norm)
        if overlap >= max(1, len(g_words) // 2):
            correct += 1

    return round(correct / len(predicted_answers), 4)

def compute_expected_calibration_error(confidences: List[float], correct_indicators: List[bool], num_bins: int = 10) -> float:
    """
    Calculates Expected Calibration Error (ECE) across confidence bins.
    """
    if not confidences or not correct_indicators:
        return 0.0

    bin_boundaries = [i / num_bins for i in range(num_bins + 1)]
    ece = 0.0
    total_samples = len(confidences)

    for i in range(num_bins):
        bin_lower = bin_boundaries[i]
        bin_upper = bin_boundaries[i + 1]

        bin_indices = [
            idx for idx, conf in enumerate(confidences)
            if (bin_lower <= conf < bin_upper) or (i == num_bins - 1 and conf == bin_upper)
        ]

        if bin_indices:
            bin_conf = sum(confidences[idx] for idx in bin_indices) / len(bin_indices)
            bin_acc = sum(1 for idx in bin_indices if correct_indicators[idx]) / len(bin_indices)
            bin_weight = len(bin_indices) / total_samples
            ece += bin_weight * abs(bin_acc - bin_conf)

    return round(ece, 4)

def compute_retrieval_recall_at_k(retrieved_ids_list: List[List[str]], relevant_ids_list: List[Set[str]], k: int = 3) -> float:
    """
    Calculates Recall@K for retrieval queries.
    """
    if not retrieved_ids_list or not relevant_ids_list:
        return 0.0

    hits = 0
    for retrieved, relevant in zip(retrieved_ids_list, relevant_ids_list):
        top_k = set(retrieved[:k])
        if top_k.intersection(relevant):
            hits += 1

    return round(hits / len(retrieved_ids_list), 4)
