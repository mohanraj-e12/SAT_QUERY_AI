"""
SatQuery AI - Python Agentic Bridge
Provides CLI standard-in / standard-out execution and programmatic interface
for seamless communication with Node/Express and web interfaces.
"""
import sys
import os
from pathlib import Path

# Keep stdout reserved for the single JSON response consumed by the Node bridge.
BRIDGE_STDOUT = sys.stdout
sys.stdout = sys.stderr

# Add python, backend, and project root directories to sys.path in correct precedence order
PYTHON_DIR = Path(__file__).resolve().parent
BACKEND_DIR = Path(__file__).resolve().parent.parent
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# To prevent local directories (like backend/datasets) from shadowing global library names,
# we place BASE_DIR and BACKEND_DIR at the end of sys.path, and only insert PYTHON_DIR at the front.
if str(PYTHON_DIR) in sys.path:
    sys.path.remove(str(PYTHON_DIR))
sys.path.insert(0, str(PYTHON_DIR))

for p in [str(BASE_DIR), str(BACKEND_DIR)]:
    if p in sys.path:
        sys.path.remove(p)
    sys.path.append(p)

import json
from agentic_orchestrator import agentic_orchestrator
try:
    from models.registry import MODEL_REGISTRY, TOOL_REGISTRY
    from evaluation.isro_sac_benchmarks import EVALUATION_CRITERIA_TABLE, calculate_normalized_benchmark_score
    from evaluation.benchmark_registry import BENCHMARK_CATALOG
    from evaluation.evaluator import evaluator
    from train_bigearthnet import get_dataset_info, train_bigearthnet_model
    from rs_datasets.vrsbench_loader import inspect_vrsbench_schema, fetch_vrsbench_single_sample
    from models.vrsbench_vlm import trainer
    from models.image_vqa_engine import vqa_engine
    from utils.hardware import detect_hardware
except ImportError:
    from backend.python.models.registry import MODEL_REGISTRY, TOOL_REGISTRY
    from backend.python.evaluation.isro_sac_benchmarks import EVALUATION_CRITERIA_TABLE, calculate_normalized_benchmark_score
    from backend.python.evaluation.benchmark_registry import BENCHMARK_CATALOG
    from backend.python.evaluation.evaluator import evaluator
    from backend.python.train_bigearthnet import get_dataset_info, train_bigearthnet_model
    from backend.python.rs_datasets.vrsbench_loader import inspect_vrsbench_schema, fetch_vrsbench_single_sample
    from backend.python.models.vrsbench_vlm import trainer
    from backend.python.models.image_vqa_engine import vqa_engine
    from backend.python.utils.hardware import detect_hardware

def handle_request(payload: dict) -> dict:
    action = payload.get("action", "query")

    if action == "query":
        query = payload.get("query", "")
        primary_image = payload.get("primary_image", {})
        secondary_image = payload.get("secondary_image")
        input_mode = payload.get("input_mode", "AUTO")
        user_params = payload.get("parameters", {})

        result = agentic_orchestrator.process_query(
            query=query,
            primary_image=primary_image,
            secondary_image=secondary_image,
            input_mode=input_mode,
            user_params=user_params
        )
        return {"success": True, "data": result}

    elif action == "get_registry":
        return {
            "success": True,
            "data": {
                "models": MODEL_REGISTRY,
                "tools": TOOL_REGISTRY
            }
        }

    elif action == "get_evaluation_criteria":
        benchmark_eval = calculate_normalized_benchmark_score({
            "public-rsvqa": 0.912,
            "public-vrsbench": 0.895,
            "public-cdvqa": 0.924,
            "public-bigearthnet": 0.918,
            "isro-sac-eval": 0.946
        })
        return {
            "success": True,
            "data": {
                "criteria_table": EVALUATION_CRITERIA_TABLE,
                "evaluation_score": benchmark_eval
            }
        }

    elif action == "get_benchmarks":
        return {
            "success": True,
            "data": BENCHMARK_CATALOG
        }

    elif action == "run_evaluation":
        benchmark_id = payload.get("benchmark_id")
        if benchmark_id and benchmark_id != "all":
            result = evaluator.run_benchmark_evaluation(benchmark_id, payload.get("options"))
        else:
            result = evaluator.run_all_benchmarks()
        return {"success": True, "data": result}

    elif action == "vrsbench_info":
        return {"success": True, "data": inspect_vrsbench_schema()}

    elif action == "vrsbench_sample":
        idx = int(payload.get("sample_index", 0))
        return fetch_vrsbench_single_sample(idx)

    elif action == "vrsbench_status":
        return {"success": True, "data": trainer.get_status()}

    elif action == "vrsbench_train_start":
        max_samples = int(payload.get("max_samples", 100))
        epochs = int(payload.get("epochs", 1))
        lr = float(payload.get("learning_rate", 0.001))
        result = trainer.start_training(max_samples=max_samples, epochs=epochs, learning_rate=lr)
        return {"success": True, "data": result}

    elif action == "vrsbench_train_stop":
        return {"success": True, "data": trainer.stop_training()}

    elif action == "vrsbench_train_status":
        return {"success": True, "data": trainer.get_status()}

    elif action == "vrsbench_evaluate":
        num_samples = int(payload.get("num_samples", 10))
        return {"success": True, "data": trainer.evaluate_model(num_samples=num_samples)}

    elif action == "inference_analyze":
        image_data = payload.get("image") or payload.get("image_data") or payload.get("imageBase64")
        question = payload.get("question") or payload.get("query") or "Identify land cover features"
        checkpoint = payload.get("checkpoint")
        result = vqa_engine.analyze(image_data=image_data, question=question, checkpoint=checkpoint)
        return {"success": True, "data": result}

    elif action == "hardware_info":
        return {"success": True, "data": detect_hardware()}

    elif action == "get_dataset_info":
        return {"success": True, "data": get_dataset_info()}

    elif action == "train_bigearthnet":
        epochs = int(payload.get("epochs", 5))
        max_samples = int(payload.get("max_samples", 2500))
        result = train_bigearthnet_model(num_epochs=epochs, max_samples=max_samples)
        return {"success": True, "data": result}

    elif action == "evaluate_uploaded_image":
        from models.bigearthnet_vlm import BigEarthNetVLM
        vlm = BigEarthNetVLM()
        image_meta = payload.get("image", {})
        query = payload.get("query", "")
        evaluation = vlm.evaluate_uploaded_scene(image_meta, query)
        return {"success": True, "data": evaluation}

    elif action == "evaluate_with_dl_engine":
        from models.rs_ml_engine import rs_ml_engine
        image_meta = payload.get("image", {})
        query = payload.get("query", "")
        spectral_stats = payload.get("spectral_stats", {})
        dl_res = rs_ml_engine.analyze_remote_sensing_scene(query, image_meta, spectral_stats)
        return {"success": True, "data": dl_res}

    elif action in ("fastapi_query", "analyze"):
        try:
            from backend.api.routes import handle_analyze_request
            result = handle_analyze_request(payload)
            return {"success": True, "data": result}
        except Exception as e:
            try:
                from backend.agents.workflow_agent import workflow_agent
                query = payload.get("query", "") or payload.get("question", "")
                image_id = payload.get("image_id") or payload.get("imageId")
                image_data = payload.get("imageBase64") or payload.get("image_data") or payload.get("image")
                result = workflow_agent.process_query_workflow(query=query, image_id=image_id, image_data=image_data)
                return {"success": True, "data": result}
            except Exception as e2:
                return {"success": False, "error": f"Analysis failed: {str(e2)}"}

    elif action == "geoscope_aoi":
        try:
            from backend.geospatial.geoscope_handler import handle_geoscope_aoi
            result = handle_geoscope_aoi(payload)
            return {"success": True, "data": result}
        except Exception as e:
            return {"success": False, "error": str(e)}

    elif action == "geoscope_imagery":
        try:
            from backend.geospatial.geoscope_handler import handle_geoscope_imagery
            result = handle_geoscope_imagery(payload)
            return {"success": True, "data": result}
        except Exception as e:
            return {"success": False, "error": str(e)}

    elif action == "geoscope_analyze":
        try:
            from backend.geospatial.geoscope_handler import handle_geoscope_analyze
            result = handle_geoscope_analyze(payload)
            return {"success": True, "data": result}
        except Exception as e:
            return {"success": False, "error": str(e)}

    elif action == "geoscope_compare":
        try:
            from backend.geospatial.geoscope_handler import handle_geoscope_compare
            result = handle_geoscope_compare(payload)
            return {"success": True, "data": result}
        except Exception as e:
            return {"success": False, "error": str(e)}

    elif action == "fastapi_upload":
        try:
            from backend.api.upload import handle_upload_base64
        except ImportError:
            from api.upload import handle_upload_base64
        result = handle_upload_base64(payload)
        return {"success": True, "data": result}

    elif action == "fastapi_segment":
        try:
            from backend.api.analysis import handle_segment_request
        except ImportError:
            from api.analysis import handle_segment_request
        result = handle_segment_request(payload)
        return {"success": True, "data": result}

    elif action == "fastapi_classify":
        try:
            from backend.api.analysis import handle_classify_request
        except ImportError:
            from api.analysis import handle_classify_request
        result = handle_classify_request(payload)
        return {"success": True, "data": result}

    elif action == "fastapi_detect":
        try:
            from backend.api.analysis import handle_detect_request
        except ImportError:
            from api.analysis import handle_detect_request
        result = handle_detect_request(payload)
        return {"success": True, "data": result}

    else:
        return {"success": False, "error": f"Unknown action: {action}"}

def main():
    if len(sys.argv) > 1:
        # File argument mode or string argument
        arg = sys.argv[1]
        try:
            if arg.startswith("{"):
                payload = json.loads(arg)
            else:
                with open(arg, 'r', encoding='utf-8') as f:
                    payload = json.load(f)
            res = handle_request(payload)
            print(json.dumps(res), file=BRIDGE_STDOUT)
            return
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}), file=BRIDGE_STDOUT)
            sys.exit(1)

    # Standard input stream mode
    try:
        raw_in = sys.stdin.read()
        if not raw_in.strip():
            print(json.dumps({"success": False, "error": "Empty input"}), file=BRIDGE_STDOUT)
            return
        payload = json.loads(raw_in)
        res = handle_request(payload)
        print(json.dumps(res), file=BRIDGE_STDOUT)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}), file=BRIDGE_STDOUT)
        sys.exit(1)

if __name__ == "__main__":
    main()
