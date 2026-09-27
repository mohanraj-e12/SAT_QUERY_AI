"""
SatQueryAI - CLI Evaluation Runner
Run: python3 backend/evaluation/evaluate.py
"""

import sys
import json
from pathlib import Path

# Add backend to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from backend.evaluation.evaluator import benchmark_evaluator

def main():
    print("==================================================")
    print(" SatQueryAI - Remote Sensing Benchmark Evaluation ")
    print("==================================================")
    print("Evaluating models on geographically isolated BigEarthNet test sets...")
    
    report = benchmark_evaluator.run_benchmark()
    
    print("\n[EVALUATION RESULTS]")
    print(f"Total Test Samples: {report['total_test_samples']}")
    print(f"Geographic Leakage Prevented: {report['geographic_leakage_prevented']}")
    print(f"Multi-label Micro F1: {report['metrics']['multilabel_micro_f1']}")
    print(f"Multi-label Macro F1: {report['metrics']['multilabel_macro_f1']}")
    print(f"Precision: {report['metrics']['precision']}")
    print(f"Recall: {report['metrics']['recall']}")
    print(f"VQA Answer Accuracy: {report['metrics']['vqa_answer_accuracy']}")
    print(f"Expected Calibration Error (ECE): {report['metrics']['expected_calibration_error_ece']}")
    print(f"Retrieval Recall@3: {report['metrics']['retrieval_recall_at_3']}")
    print("\nEvaluation report saved to: backend/evaluation/report.json\n")

if __name__ == "__main__":
    main()
