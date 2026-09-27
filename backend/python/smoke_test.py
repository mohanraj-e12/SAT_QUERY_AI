"""
SatQueryAI VRSBench Pipeline Smoke Test
Validates all execution environment and VLM training requirements.
Runs real streaming, preprocessing, tiny training, checkpointing,
checkpoint loading, and two-image inference on real VRSBench data.
"""
import os
import sys
import time
from pathlib import Path

try:
    import torch
except (ImportError, ModuleNotFoundError):
    torch = None

try:
    from PIL import Image
except (ImportError, ModuleNotFoundError):
    Image = None

# Setup sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from rs_datasets.vrsbench_loader import load_vrsbench_train
from models.vrsbench_vlm import SimpleVRSBenchVLM, VRSBenchVLM
from models.image_vqa_engine import vqa_engine
from training.trainer import VRSBenchTrainer

def run_smoke_test():
    results = {
        "VRSBench Connection": "FAIL",
        "VRSBench Streaming": "FAIL",
        "Real Samples": "FAIL",
        "Image Preprocessing": "FAIL",
        "VLM Loading": "FAIL",
        "Tiny Training": "FAIL",
        "Checkpoint": "FAIL",
        "Checkpoint Loading": "FAIL",
        "Two-Image Inference": "FAIL",
        "Frontend API": "FAIL"
    }

    print("======================================================================")
    print("STARTING REAL VRSBENCH SMOKE TEST")
    print("======================================================================")

    # 1. Check Python & PyTorch Hardware
    print("\n--- 1. Hardware Detection ---")
    print("PyTorch version:", torch.__version__)
    cuda_available = torch.cuda.is_available()
    print("CUDA available:", cuda_available)
    if cuda_available:
        print("GPU Device:", torch.cuda.get_device_name(0))
        print("CUDA version:", torch.version.cuda)
    else:
        print("Operating Mode: CPU Only")

    # 2. VRSBench Dataset Loading & Connection
    print("\n--- 2. VRSBench Connection & Streaming ---")
    dataset = None
    try:
        dataset = load_vrsbench_train()
        print("PASS: VRSBench Connection established successfully.")
        results["VRSBench Connection"] = "PASS"
    except Exception as e:
        print("FAIL: VRSBench Connection failed:", e)
        return results

    # 3. Stream & Retrieve Real Samples
    print("\n--- 3. Real Samples Retrieval ---")
    samples = []
    try:
        iterator = iter(dataset)
        for i in range(5):
            sample = next(iterator)
            samples.append(sample)
            print(f"Retrieved real sample {i} successfully. Caption length: {len(sample.get('caption', ''))}")
        
        results["VRSBench Streaming"] = "PASS"
        results["Real Samples"] = "PASS"
    except Exception as e:
        print("FAIL: Streaming real samples failed:", e)
        return results

    # 4. Image Preprocessing Validation
    print("\n--- 4. Image Preprocessing & VLM Loading ---")
    vlm = None
    try:
        vlm = VRSBenchVLM()
        print("PASS: VRSBench VLM loaded into memory.")
        results["VLM Loading"] = "PASS"
        
        # Test preprocessing on the first sample
        first_sample = samples[0]
        img = first_sample.get("image")
        q = first_sample.get("qa_pairs", [{}])[0].get("question", "What is in the image?")
        
        img_tensor, txt_tensor = vlm.prepare_inputs(img, q)
        print("PASS: Preprocessing completed. Image tensor shape:", img_tensor.shape)
        print("Text tensor shape:", txt_tensor.shape)
        results["Image Preprocessing"] = "PASS"
    except Exception as e:
        print("FAIL: Preprocessing or VLM loading failed:", e)
        return results

    # 5. Run Tiny Training Test (5 samples)
    print("\n--- 5. Tiny Training (Loss & Backprop) ---")
    checkpoint_path = os.path.join(os.path.dirname(__file__), "vrsbench_checkpoint.pt")
    
    # Remove old checkpoint if exists
    if os.path.exists(checkpoint_path):
        os.remove(checkpoint_path)

    try:
        optimizer = torch.optim.Adam(vlm.model.parameters(), lr=0.001)
        criterion = torch.nn.CrossEntropyLoss()
        
        vlm.model.train()
        print("Running training forward/backward pass over 5 real samples...")
        for idx, sample in enumerate(samples):
            img = sample.get("image")
            qa_list = sample.get("qa_pairs", [])
            if not qa_list:
                continue
            qa = qa_list[0]
            question = qa.get("question", "")
            answer = qa.get("answer", "")
            
            img_tensor, txt_tensor = vlm.prepare_inputs(img, question)
            label = vlm._map_answer_to_label(answer)
            label_tensor = torch.tensor([label], dtype=torch.long, device=vlm.device)
            
            optimizer.zero_grad()
            logits = vlm.model(img_tensor, txt_tensor)
            loss = criterion(logits, label_tensor)
            loss.backward()
            optimizer.step()
            
            print(f"Sample {idx} | Question: '{question}' | Label Class: {label} | Loss: {loss.item():.4f}")

        results["Tiny Training"] = "PASS"
    except Exception as e:
        print("FAIL: Training pipeline errored:", e)
        return results

    # 6. Checkpoint Creation & Saving
    print("\n--- 6. Saving Checkpoint ---")
    try:
        vlm.save_checkpoint(checkpoint_path)
        if os.path.exists(checkpoint_path):
            print(f"PASS: Checkpoint file created successfully at {checkpoint_path}")
            print(f"Checkpoint size: {os.path.getsize(checkpoint_path)} bytes")
            results["Checkpoint"] = "PASS"
        else:
            print("FAIL: Checkpoint path does not exist.")
    except Exception as e:
        print("FAIL: Saving checkpoint failed:", e)

    # 7. Loading Checkpoint Successfully
    print("\n--- 7. Loading Checkpoint ---")
    try:
        new_vlm = VRSBenchVLM()
        success = new_vlm.load_checkpoint(checkpoint_path)
        if success:
            print("PASS: Checkpoint loaded successfully and weights restored.")
            results["Checkpoint Loading"] = "PASS"
        else:
            print("FAIL: Checkpoint loading returned False.")
    except Exception as e:
        print("FAIL: Loading checkpoint failed:", e)

    # 8. Two-Image Inference with Checkpoint
    print("\n--- 8. Two-Image Inference (REAL Images) ---")
    try:
        # Use image from sample 1 and sample 2
        img1 = samples[1].get("image")
        qa1 = samples[1].get("qa_pairs", [{}])[0]
        q1 = qa1.get("question", "What is the scene type?")
        gt1 = qa1.get("answer", "")

        img2 = samples[2].get("image")
        qa2 = samples[2].get("qa_pairs", [{}])[0]
        q2 = qa2.get("question", "What is the scene type?")
        gt2 = qa2.get("answer", "")

        print("\nTesting Question on Image 1:")
        ans1 = vqa_engine.analyze(img1, q1, checkpoint=checkpoint_path)
        print(f"Image 1 | Question: '{q1}'")
        print(f"Ground Truth: '{gt1}' | VLM Output: '{ans1['answer']}'")

        print("\nTesting Question on Image 2:")
        ans2 = vqa_engine.analyze(img2, q2, checkpoint=checkpoint_path)
        print(f"Image 2 | Question: '{q2}'")
        print(f"Ground Truth: '{gt2}' | VLM Output: '{ans2['answer']}'")

        results["Two-Image Inference"] = "PASS"
    except Exception as e:
        print("FAIL: Two-Image inference failed:", e)

    # 9. Verify Frontend Bridge API Integration
    print("\n--- 9. Frontend API Integration ---")
    try:
        from bridge import handle_request
        payload = {
            "action": "vrsbench_info"
        }
        resp = handle_request(payload)
        if resp.get("success") and "features" in resp.get("data", {}):
            print("PASS: Frontend bridge API responded correctly for 'vrsbench_info'.")
            results["Frontend API"] = "PASS"
        else:
            print("FAIL: Bridge API returned unexpected response:", resp)
    except Exception as e:
        print("FAIL: Bridge API test failed:", e)

    # Output Validation Matrix
    print("\n======================================================================")
    print("VRSBENCH SMOKE TEST VALIDATION MATRIX")
    print("======================================================================")
    for k, v in results.items():
        print(f"{k}: {v}")
    print("======================================================================\n")

if __name__ == "__main__":
    run_smoke_test()
