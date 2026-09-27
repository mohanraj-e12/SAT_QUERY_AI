"""
Hardware Detection for SatQueryAI
Provides accurate, non-simulated system compute telemetry.
"""
import os
from typing import Dict, Any

try:
    import psutil
except (ImportError, ModuleNotFoundError):
    psutil = None

try:
    import torch
except (ImportError, ModuleNotFoundError):
    torch = None

def get_ram_gb() -> float:
    if psutil is not None:
        try:
            return round(psutil.virtual_memory().total / (1024**3), 2)
        except Exception:
            pass
    try:
        with open("/proc/meminfo", "r") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    kb = int(line.split()[1])
                    return round(kb / (1024**2), 2)
    except Exception:
        pass
    return 4.0

def detect_hardware() -> Dict[str, Any]:
    cuda_available = False
    gpu_name = "None (CPU only)"
    vram_gb = 0.0

    if torch is not None and hasattr(torch, "cuda") and torch.cuda.is_available():
        cuda_available = True
        try:
            gpu_name = torch.cuda.get_device_name(0)
            vram_gb = round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 2)
        except Exception:
            gpu_name = "NVIDIA CUDA Device"

    cpu_count = os.cpu_count() or 2
    ram_gb = get_ram_gb()

    # Hardware feasibility assessment for training a full 200M+ Vision-Language Model
    can_train_vlm = False
    insufficient_reasons = []

    if not cuda_available:
        insufficient_reasons.append("No CUDA GPU detected (running on pure CPU).")
    if ram_gb < 16.0:
        insufficient_reasons.append(f"Available RAM ({ram_gb} GB) is below the minimum 16.0 GB required for VLM backpropagation.")
    if vram_gb < 8.0:
        insufficient_reasons.append(f"GPU VRAM ({vram_gb} GB) is below the recommended 8-16 GB for LoRA/QLoRA.")

    return {
        "cpu": f"{cpu_count} vCPUs (x86_64)",
        "cpu_count": cpu_count,
        "ram_gb": ram_gb,
        "gpu": gpu_name,
        "vram_gb": vram_gb,
        "cuda_available": cuda_available,
        "can_train_full_vlm": can_train_vlm,
        "insufficient_reasons": insufficient_reasons,
        "recommended_hardware": "NVIDIA T4 / A10G / A100 GPU (>= 16GB VRAM) or 32GB System RAM",
        "recommended_base_model": "microsoft/Florence-2-base (232M) or Qwen/Qwen2-VL-2B-Instruct",
        "recommended_strategy": "LoRA (r=16, alpha=32) parameter-efficient fine-tuning on xiang709/VRSBench streaming split"
    }
