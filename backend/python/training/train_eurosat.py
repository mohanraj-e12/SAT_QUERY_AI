"""
SatQueryAI - EuroSAT PyTorch Training Pipeline
Trains a remote sensing classification model on EuroSAT using transfer learning.
Features:
- PyTorch Dataset & DataLoader with stratified split loading
- Data augmentations (RandomHorizontalFlip, RandomVerticalFlip, ColorJitter)
- Pretrained vision backbone (ResNet-18)
- Optimizer (AdamW) & Learning rate scheduler (CosineAnnealingLR)
- Validation loop with metrics: Accuracy, Precision, Recall, F1-score (macro), Confusion matrix
- Model checkpoint saving (eurosat_model.pt) & comprehensive metadata (eurosat_model_metadata.json)
- Early stopping
"""

import os
import sys
import time
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Tuple, List, Optional

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import torchvision.transforms as T
from PIL import Image

try:
    from sklearn.metrics import precision_recall_fscore_support, confusion_matrix
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

# Setup sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
PYTHON_DIR = SCRIPT_DIR.parent
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from datasets.eurosat_config import find_eurosat_paths, EUROSAT_CLASSES
from datasets.dataset_split import create_eurosat_splits
from models.eurosat_net import EuroSATClassifier

class EuroSATDataset(Dataset):
    def __init__(self, samples: List[Dict[str, Any]], transform=None):
        self.samples = samples
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        item = self.samples[idx]
        img_path = item["path"]
        label = item["label"]
        with Image.open(img_path) as img:
            rgb_img = img.convert("RGB")
            if self.transform:
                x = self.transform(rgb_img)
            else:
                x = T.ToTensor()(rgb_img)
        return x, label
def get_transforms():
    train_transform = T.Compose([
        T.Resize((64, 64)),
        T.RandomHorizontalFlip(p=0.5),
        T.RandomVerticalFlip(p=0.5),
        T.RandomRotation(degrees=15),
        T.ColorJitter(brightness=0.1, contrast=0.1),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    eval_transform = T.Compose([
        T.Resize((64, 64)),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    return train_transform, eval_transform

def evaluate_model(model: nn.Module, loader: DataLoader, criterion: nn.Module, device: torch.device):
    model.eval()
    total_loss = 0.0
    all_preds = []
    all_targets = []

    with torch.no_grad():
        for x, y in loader:
            x, y = x.to(device), y.to(device)
            logits = model(x)
            loss = criterion(logits, y)
            total_loss += loss.item() * x.size(0)
            preds = torch.argmax(logits, dim=-1)
            all_preds.extend(preds.cpu().numpy().tolist())
            all_targets.extend(y.cpu().numpy().tolist())

    n_samples = len(all_targets)
    avg_loss = total_loss / max(n_samples, 1)

    all_preds_t = torch.tensor(all_preds)
    all_targets_t = torch.tensor(all_targets)
    accuracy = float((all_preds_t == all_targets_t).float().mean().item())

    if SKLEARN_AVAILABLE and n_samples > 0:
        prec, rec, f1, _ = precision_recall_fscore_support(all_targets, all_preds, average="macro", zero_division=0)
        cm = confusion_matrix(all_targets, all_preds).tolist()
    else:
        prec, rec, f1 = accuracy, accuracy, accuracy
        cm = []

    return {
        "loss": avg_loss,
        "accuracy": accuracy,
        "precision": float(prec),
        "recall": float(rec),
        "f1": float(f1),
        "confusion_matrix": cm,
        "predictions": all_preds,
        "targets": all_targets
    }

def train_eurosat(
    epochs: int = 5,
    batch_size: int = 32,
    lr: float = 3e-4,
    dataset_root: Optional[str] = None,
    output_dir: Optional[str] = None,
    max_train_samples: Optional[int] = None,
    max_val_samples: Optional[int] = None,
    early_stopping_patience: int = 3,
    backbone_name: str = "resnet18"
) -> Dict[str, Any]:
    start_time = time.time()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    print("\n" + "=" * 70)
    print("🛰️  SATQUERYAI - EUROsat TRAINING PIPELINE")
    print("=" * 70)
    print("Dataset: EuroSAT RGB")
    print(f"Model Backbone: {backbone_name}")
    print(f"Compute Device: {device} (CUDA available: {torch.cuda.is_available()})")
    print(f"Training status: TRAINING")
    print("=" * 70 + "\n")

    paths = find_eurosat_paths(dataset_root)
    rgb_path = paths["rgb_path"]
    if not rgb_path or not rgb_path.exists():
        raise FileNotFoundError(f"EuroSAT RGB path could not be located: {rgb_path}")

    splits_file = PYTHON_DIR / "datasets" / "eurosat" / "splits" / "eurosat_rgb_split.json"
    if not splits_file.exists():
        print("Generating train/val/test splits first...")
        create_eurosat_splits(rgb_path, seed=42)

    with open(splits_file, "r", encoding="utf-8") as f:
        split_meta = json.load(f)

    train_samples = split_meta["splits"]["train"]
    val_samples = split_meta["splits"]["val"]
    test_samples = split_meta["splits"]["test"]

    if max_train_samples and max_train_samples < len(train_samples):
        train_samples = train_samples[:max_train_samples]
    if max_val_samples and max_val_samples < len(val_samples):
        val_samples = val_samples[:max_val_samples]
        test_samples = test_samples[:max_val_samples]

    print(f"Dataset summary:")
    print(f"  Training samples  : {len(train_samples):,}")
    print(f"  Validation samples: {len(val_samples):,}")
    print(f"  Test samples      : {len(test_samples):,}")
    print(f"  Classes ({len(EUROSAT_CLASSES)})   : {', '.join(EUROSAT_CLASSES)}")

    train_tf, eval_tf = get_transforms()
    train_ds = EuroSATDataset(train_samples, transform=train_tf)
    val_ds = EuroSATDataset(val_samples, transform=eval_tf)
    test_ds = EuroSATDataset(test_samples, transform=eval_tf)

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False, num_workers=0)

    model = EuroSATClassifier(num_classes=10, backbone_name=backbone_name, pretrained=True).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    best_val_acc = 0.0
    best_val_loss = float("inf")
    patience_counter = 0

    if output_dir:
        out_path = Path(output_dir)
    else:
        out_path = PYTHON_DIR / "models"
    out_path.mkdir(parents=True, exist_ok=True)
    checkpoint_file = out_path / "eurosat_model.pt"
    metadata_file = out_path / "eurosat_model_metadata.json"

    epoch_history = []

    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        train_correct = 0
        train_total = 0

        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            logits = model(x)
            loss = criterion(logits, y)
            loss.backward()
            optimizer.step()

            train_loss += loss.item() * x.size(0)
            preds = torch.argmax(logits, dim=-1)
            train_correct += (preds == y).sum().item()
            train_total += x.size(0)

        scheduler.step()
        epoch_train_loss = train_loss / max(train_total, 1)
        epoch_train_acc = train_correct / max(train_total, 1)

        val_metrics = evaluate_model(model, val_loader, criterion, device)
        print(f"Epoch [{epoch}/{epochs}] - Train Loss: {epoch_train_loss:.4f}, Train Acc: {epoch_train_acc:.4f} | "
              f"Val Loss: {val_metrics['loss']:.4f}, Val Acc: {val_metrics['accuracy']:.4f}, F1: {val_metrics['f1']:.4f}")

        epoch_history.append({
            "epoch": epoch,
            "train_loss": epoch_train_loss,
            "train_accuracy": epoch_train_acc,
            "val_loss": val_metrics["loss"],
            "val_accuracy": val_metrics["accuracy"],
            "val_f1": val_metrics["f1"]
        })

        if val_metrics["accuracy"] > best_val_acc:
            best_val_acc = val_metrics["accuracy"]
            best_val_loss = val_metrics["loss"]
            patience_counter = 0
            torch.save({
                "model_state_dict": model.state_dict(),
                "backbone": backbone_name,
                "num_classes": 10,
                "classes": EUROSAT_CLASSES,
                "best_val_accuracy": best_val_acc,
                "epoch": epoch,
                "trained": True,
                "timestamp": datetime.utcnow().isoformat()
            }, checkpoint_file)
            print(f"  -> Saved new best model checkpoint to {checkpoint_file} (Val Acc: {best_val_acc:.4f})")
        else:
            patience_counter += 1
            if patience_counter >= early_stopping_patience:
                print(f"Early stopping triggered at epoch {epoch}")
                break

    # Load best checkpoint for final evaluation on test set
    if checkpoint_file.exists():
        best_ckpt = torch.load(checkpoint_file, map_location=device)
        model.load_state_dict(best_ckpt["model_state_dict"])

    test_metrics = evaluate_model(model, test_loader, criterion, device)
    total_time = round(time.time() - start_time, 2)

    metadata = {
        "model_architecture": backbone_name,
        "dataset": "EuroSAT RGB",
        "number_of_classes": 10,
        "classes": EUROSAT_CLASSES,
        "training_samples": len(train_samples),
        "validation_samples": len(val_samples),
        "test_samples": len(test_samples),
        "epochs": epochs,
        "batch_size": batch_size,
        "learning_rate": lr,
        "best_val_accuracy": round(best_val_acc, 4),
        "test_accuracy": round(test_metrics["accuracy"], 4),
        "test_loss": round(test_metrics["loss"], 4),
        "precision": round(test_metrics["precision"], 4),
        "recall": round(test_metrics["recall"], 4),
        "f1_score": round(test_metrics["f1"], 4),
        "confusion_matrix": test_metrics["confusion_matrix"],
        "training_timestamp": datetime.utcnow().isoformat(),
        "total_training_time_seconds": total_time,
        "checkpoint_path": str(checkpoint_file.resolve()),
        "trained": True,
        "history": epoch_history
    }

    with open(metadata_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print("\n" + "=" * 70)
    print("Training completed successfully.")
    print(f"Dataset: EuroSAT")
    print(f"Model: {backbone_name}")
    print(f"Checkpoint: {checkpoint_file}")
    print(f"Training status: TRAINED")
    print(f"Best validation accuracy: {best_val_acc:.4f}")
    print(f"Test accuracy: {test_metrics['accuracy']:.4f}")
    print(f"F1-score: {test_metrics['f1']:.4f}")
    print(f"Total training time: {total_time}s")
    print("=" * 70 + "\n")

    return metadata

def main():
    parser = argparse.ArgumentParser(description="Train EuroSAT Land-Cover Classifier")
    parser.add_argument("--epochs", type=int, default=5, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--learning-rate", type=float, default=3e-4, help="Learning rate")
    parser.add_argument("--dataset-root", type=str, default=None, help="Dataset root path")
    parser.add_argument("--output-dir", type=str, default=None, help="Output directory for checkpoints")
    parser.add_argument("--max-train-samples", type=int, default=None, help="Cap training samples for quick runs")
    parser.add_argument("--max-val-samples", type=int, default=None, help="Cap validation samples")
    parser.add_argument("--backbone", type=str, default="resnet18", choices=["resnet18", "mobilenet_v3_small"])
    args = parser.parse_args()

    train_eurosat(
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.learning_rate,
        dataset_root=args.dataset_root,
        output_dir=args.output_dir,
        max_train_samples=args.max_train_samples,
        max_val_samples=args.max_val_samples,
        backbone_name=args.backbone
    )

if __name__ == "__main__":
    main()

