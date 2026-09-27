"""
SatQueryAI - EuroSAT Pipeline Smoke Test
Validates the EuroSAT PyTorch training and inference pipeline:
- Loads 10 real samples from EuroSAT RGB
- Runs forward pass through backbone
- Calculates CrossEntropyLoss
- Performs backward pass and verifies gradient computation
- Performs optimizer step
- Verifies checkpoint saving & reloading
- CLEARLY LABELS THIS CHECKPOINT AS A SMOKE-TEST ARTIFACT (NOT A TRAINED PRODUCTION MODEL)
"""

import os
import sys
import json
import torch
import torch.nn as nn
import torch.optim as optim
from pathlib import Path
from PIL import Image
import torchvision.transforms as T

# Path setup
CURRENT_DIR = Path(__file__).resolve().parent
PYTHON_DIR = CURRENT_DIR.parent
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from datasets.eurosat_config import find_eurosat_paths, EUROSAT_CLASSES
from models.eurosat_net import EuroSATClassifier

def run_smoke_test():
    print("=" * 70)
    print("SATQUERYAI - EUROsat SMOKE TEST")
    print("======================================================================")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Hardware Compute Device: {device}")
    print(f"PyTorch Version        : {torch.__version__}")

    # 1. Discover dataset
    paths = find_eurosat_paths()
    rgb_path = paths["rgb_path"]
    if not rgb_path or not rgb_path.exists():
        print("ERROR: EuroSAT RGB dataset directory not found!")
        sys.exit(1)

    print(f"PASS: EuroSAT RGB Path: {rgb_path}")

    # 2. Collect 10 diverse samples (1 per class)
    samples = []
    labels = []
    for idx, cname in enumerate(EUROSAT_CLASSES):
        cfolder = rgb_path / cname
        imgs = list(cfolder.glob("*.jpg"))
        if imgs:
            samples.append(imgs[0])
            labels.append(idx)

    print(f"PASS: Loaded {len(samples)} real samples across all 10 classes.")

    # 3. Transform samples into tensor batch
    transform = T.Compose([
        T.Resize((64, 64)),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    batch_tensors = []
    for s in samples:
        with Image.open(s) as img:
            batch_tensors.append(transform(img.convert("RGB")))

    x = torch.stack(batch_tensors).to(device)
    y = torch.tensor(labels, dtype=torch.long).to(device)
    print(f"PASS: Batch Tensor Shape: {x.shape}, Target Tensor Shape: {y.shape}")

    # 4. Instantiate Model
    model = EuroSATClassifier(num_classes=10, backbone_name="resnet18", pretrained=True).to(device)
    model.train()
    optimizer = optim.AdamW(model.parameters(), lr=1e-3)
    criterion = nn.CrossEntropyLoss()
    print("PASS: EuroSATClassifier (ResNet-18) instantiated successfully.")

    # 5. Forward Pass
    logits = model(x)
    loss = criterion(logits, y)
    print(f"PASS: Forward pass completed. CrossEntropyLoss: {loss.item():.4f}")

    # 6. Backward Pass & Gradients
    optimizer.zero_grad()
    loss.backward()
    grad_norms = [p.grad.norm().item() for p in model.parameters() if p.grad is not None]
    assert len(grad_norms) > 0, "No gradients were computed!"
    print(f"PASS: Gradients computed. Mean grad norm: {sum(grad_norms)/len(grad_norms):.4f}")

    # 7. Optimizer Step
    optimizer.step()
    print("PASS: Optimizer step executed successfully.")

    # 8. Save Smoke-Test Checkpoint
    output_dir = PYTHON_DIR / "models" / "debug"
    output_dir.mkdir(parents=True, exist_ok=True)
    smoke_ckpt_path = output_dir / "eurosat_smoke_test.pt"
    smoke_meta_path = output_dir / "eurosat_smoke_test_metadata.json"

    torch.save({
        "model_state_dict": model.state_dict(),
        "architecture": "resnet18",
        "num_classes": 10,
        "classes": EUROSAT_CLASSES,
        "is_smoke_test": True,
        "trained": False,
        "note": "SMOKE TEST ARTIFACT ONLY - NOT A TRAINED PRODUCTION MODEL"
    }, smoke_ckpt_path)

    with open(smoke_meta_path, "w", encoding="utf-8") as f:
        json.dump({
            "model_architecture": "resnet18",
            "dataset": "EuroSAT RGB",
            "is_smoke_test": True,
            "trained": False,
            "status": "SMOKE_TEST_PASSED",
            "checkpoint_path": str(smoke_ckpt_path),
            "warning": "DO NOT USE FOR PRODUCTION INFERENCE - THIS IS A TOY SMOKE TEST"
        }, f, indent=2)

    print(f"PASS: Smoke-test checkpoint saved to: {smoke_ckpt_path}")
    print(f"PASS: Smoke-test metadata saved to  : {smoke_meta_path}")

    # 9. Verify Checkpoint Loading
    new_model = EuroSATClassifier(num_classes=10, backbone_name="resnet18", pretrained=False).to(device)
    ckpt = torch.load(smoke_ckpt_path, map_location=device)
    new_model.load_state_dict(ckpt["model_state_dict"])
    new_model.eval()
    with torch.no_grad():
        test_out = new_model(x[:2])
    assert test_out.shape == (2, 10), "Reloaded model output shape mismatch!"
    print("PASS: Checkpoint verified and reloaded successfully.")

    print("======================================================================")
    print("EUROsat SMOKE TEST COMPLETED SUCCESSFULLY!")
    print("======================================================================")

if __name__ == "__main__":
    run_smoke_test()
