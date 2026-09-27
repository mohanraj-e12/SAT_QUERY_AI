"""
SatQuery AI - Formal Model Registry
Tracks actual base models, training datasets, hyperparameters, and verifiable checkpoints.
Does not include fabricated benchmark numbers as achieved metrics.
"""
from typing import Dict, Any, Optional
import os
from datetime import datetime

class ModelRegistry:
    def __init__(self):
        self.registry: Dict[str, Dict[str, Any]] = {
            "VRSBench-FineTuned-VLM": {
                "model_name": "VRSBench-FineTuned-VLM",
                "base_model": "microsoft/Florence-2-base",
                "dataset": "xiang709/VRSBench",
                "dataset_config": "VRSBench",
                "split": "train",
                "training_method": "LoRA (Low-Rank Adaptation, r=16, alpha=32)",
                "samples_processed": 0,
                "steps": 0,
                "epochs": 0,
                "training_loss": None,
                "validation_loss": None,
                "checkpoint_path": None,
                "created_at": None,
                "status": "NOT_TRAINED"  # Explicitly NOT_TRAINED: no real trained checkpoint exists yet
            }
        }

    def register(
        self,
        model_name: str,
        base_model: str,
        dataset: str,
        dataset_config: str,
        split: str,
        training_method: str,
        samples_processed: int,
        steps: int,
        epochs: int,
        training_loss: Optional[float],
        validation_loss: Optional[float],
        checkpoint_path: Optional[str],
        status: str = "NOT_TRAINED"
    ) -> Dict[str, Any]:
        actual_status = status
        if checkpoint_path and not os.path.exists(checkpoint_path):
            actual_status = "CHECKPOINT_NOT_FOUND"

        entry = {
            "model_name": model_name,
            "base_model": base_model,
            "dataset": dataset,
            "dataset_config": dataset_config,
            "split": split,
            "training_method": training_method,
            "samples_processed": samples_processed,
            "steps": steps,
            "epochs": epochs,
            "training_loss": training_loss,
            "validation_loss": validation_loss,
            "checkpoint_path": checkpoint_path,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "status": actual_status
        }
        self.registry[model_name] = entry
        return entry

    def get_model(self, model_name: str) -> Optional[Dict[str, Any]]:
        return self.registry.get(model_name)

    def list_models(self) -> Dict[str, Dict[str, Any]]:
        return self.registry

model_registry = ModelRegistry()
