"""Honest trained-model availability audit for SatQueryAI.

Verifies which specialist checkpoints actually exist on disk and which
machine-learning libraries are importable, so that modules only claim a
trained model when one can genuinely be loaded and used. No fabricated
predictions, confidences or "model active" states are produced here.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any, Dict, List, Optional

MODELS_DIR = Path(__file__).resolve().parent

# Trained-model resources that SatQueryAI modules would need.
MODEL_SPECS: List[Dict[str, Any]] = [
    {
        "model": "EuroSAT scene classifier",
        "module": "scene_classification",
        "checkpoint": str(MODELS_DIR / "eurosat_model.pt"),
        "required_libraries": ["torch"],
    },
    {
        "model": "Land-cover classifier (CLC-19 / BigEarthNet)",
        "module": "land_cover",
        "checkpoint": None,
        "required_libraries": ["torch"],
    },
    {
        "model": "Object detection network",
        "module": "object_detection",
        "checkpoint": None,
        "required_libraries": ["torch"],
    },
    {
        "model": "Trained vision-language model (VLM)",
        "module": "vlm",
        "checkpoint": None,
        "required_libraries": ["torch", "transformers"],
    },
    {
        "model": "GeoRSCLIP remote-sensing CLIP",
        "module": "zeroshot_classification",
        "checkpoint": None,
        "required_libraries": ["torch", "transformers"],
    },
    {
        "model": "SAM (Segment Anything) segmenter",
        "module": "sam_segmentation",
        "checkpoint": None,
        "required_libraries": ["torch", "segment_anything"],
    },
    {
        "model": "VRSBench fine-tuned VLM (LoRA)",
        "module": "scene_captioning",
        "checkpoint": None,
        "required_libraries": ["torch", "transformers"],
        "registry_status": "NOT_TRAINED",
    },
    {
        "model": "EuroSAT smoke-test checkpoint",
        "module": "diagnostics_only",
        "checkpoint": str(MODELS_DIR / "checkpoints" / "eurosat_smoke_test.pt"),
        "required_libraries": ["torch"],
        "smoke_test": True,
    },
]

_AUDIT_CACHE: Optional[Dict[str, Any]] = None


def _library_available(name: str) -> bool:
    try:
        return importlib.util.find_spec(name) is not None
    except (ImportError, ValueError):
        return False


def verify_trained_models(force: bool = False) -> Dict[str, Any]:
    """Return the audited availability of every trained-model resource."""
    global _AUDIT_CACHE
    if _AUDIT_CACHE is not None and not force:
        return _AUDIT_CACHE

    entries: List[Dict[str, Any]] = []
    for spec in MODEL_SPECS:
        checkpoint = spec.get("checkpoint")
        checkpoint_exists = bool(checkpoint) and Path(checkpoint).exists()
        missing_libraries = [
            name for name in spec.get("required_libraries", []) if not _library_available(name)
        ]
        if not checkpoint:
            status = spec.get("registry_status", "NO_CHECKPOINT")
            usable = False
        elif not checkpoint_exists:
            status = "CHECKPOINT_NOT_FOUND"
            usable = False
        elif missing_libraries:
            status = "LIBRARY_UNAVAILABLE"
            usable = False
        elif spec.get("smoke_test"):
            status = "SMOKE_TEST_ONLY"
            usable = False
        else:
            status = "LOADABLE"
            usable = True

        entries.append({
            "model": spec["model"],
            "module": spec["module"],
            "checkpoint": checkpoint,
            "checkpoint_exists": checkpoint_exists,
            "missing_libraries": missing_libraries,
            "status": status,
            # Never claim a usable model unless the checkpoint exists, its
            # libraries import and the weights are not smoke-test artefacts.
            "usable_for_claims": usable,
        })

    _AUDIT_CACHE = {
        "audited_models": entries,
        "usable_models": [entry["model"] for entry in entries if entry["usable_for_claims"]],
        "unavailable_models": [entry["model"] for entry in entries if not entry["usable_for_claims"]],
        "note": (
            "Modules must not claim a trained model unless its status is LOADABLE. "
            "Deterministic image-derived analysis is used otherwise."
        ),
    }
    return _AUDIT_CACHE


def module_model_status(module: str) -> Dict[str, Any]:
    """Report whether a module has a genuinely usable trained checkpoint."""
    audit = verify_trained_models()
    matches = [entry for entry in audit["audited_models"] if entry["module"] == module]
    return {
        "module": module,
        "trained_model_available": any(entry["usable_for_claims"] for entry in matches),
        "candidates": matches,
    }


def audit_summary_text() -> str:
    """One-line honest statement of trained-model availability."""
    audit = verify_trained_models()
    usable = audit["usable_models"]
    if usable:
        return "Loadable trained checkpoints: " + ", ".join(usable) + "."
    return "No trained specialist checkpoint is loadable; deterministic image-derived analysis is used."
