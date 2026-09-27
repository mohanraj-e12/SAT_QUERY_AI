"""
SatQuery AI - Test Suite for Python Machine Learning Models and Agentic Pipeline
"""
import base64
import io
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import unittest
import numpy as np
from PIL import Image
from agentic_orchestrator import agentic_orchestrator
from models.registry import MODEL_REGISTRY, TOOL_REGISTRY
from evaluation.isro_sac_benchmarks import calculate_normalized_benchmark_score, EVALUATION_CRITERIA_TABLE


def image_data_uri(pixels):
    output = io.BytesIO()
    Image.fromarray(pixels.astype(np.uint8)).save(output, format="PNG")
    return "data:image/png;base64," + base64.b64encode(output.getvalue()).decode("ascii")


class TestSatQueryAIPythonBackend(unittest.TestCase):

    def setUp(self):
        optical_pixels = np.zeros((24, 24, 3), dtype=np.uint8)
        optical_pixels[:, :12] = [20, 60, 120]
        optical_pixels[:, 12:] = [30, 150, 45]
        vegetation_pixels = np.full((24, 24, 3), [30, 150, 45], dtype=np.uint8)
        water_pixels = np.full((24, 24, 3), [20, 60, 120], dtype=np.uint8)
        self.optical_img = {
            "id": "test-optical-01",
            "satellite": "Cartosat-2S",
            "sensor": "PAN/MS High Resolution Optical",
            "resolution_meters": 0.65,
            "latitude": 28.6139,
            "longitude": 77.2090,
            "acquisition_date": "2025-11-15",
            "format": "GeoTIFF",
            "cloud_percentage": 0.8,
            "bands": ["Red", "Green", "Blue"],
            "file_url": image_data_uri(optical_pixels),
        }

        self.sar_img = {
            "id": "test-sar-01",
            "satellite": "RISAT-1A (EOS-04)",
            "sensor": "C-Band SAR Hybrid/Dual Pol",
            "resolution_meters": 1.0,
            "latitude": 28.6139,
            "longitude": 77.2090,
            "acquisition_date": "2025-11-15",
            "format": "GeoTIFF",
            "polarization": "VV / VH Dual-Pol",
            "file_url": image_data_uri(water_pixels),
        }

        self.bitemporal_t2 = {
            "id": "test-optical-t2",
            "satellite": "Sentinel-2B",
            "sensor": "MSI",
            "resolution_meters": 10.0,
            "latitude": 28.6139,
            "longitude": 77.2090,
            "acquisition_date": "2026-02-10",
            "format": "GeoTIFF",
            "file_url": image_data_uri(vegetation_pixels),
        }

    def test_model_registry(self):
        self.assertIn("RS-BigEarthNet-VLM", MODEL_REGISTRY)
        self.assertIn("RSVQA-Specialist", MODEL_REGISTRY)
        self.assertIn("VRSBench-Captioner", MODEL_REGISTRY)
        self.assertIn("RS-Grounding-Net", MODEL_REGISTRY)
        self.assertIn("CDVQA-BiTemporal-Net", MODEL_REGISTRY)
        self.assertIn("Optical-SAR-Fusion-Net", MODEL_REGISTRY)
        self.assertIn("Radiometric-Spectral-Engine", MODEL_REGISTRY)

    def test_single_image_vqa(self):
        res = agentic_orchestrator.process_query(
            query="Assess vegetation canopy density and crop vigor in this scene",
            primary_image=self.optical_img
        )
        self.assertIn("summary", res)
        self.assertIn("50.00%", res["summary"])
        self.assertEqual(res["statistics"]["imageType"], "rgb")
        self.assertEqual(res["agents_executed"], ["ImageDecoder", "DeterministicImageAnalysis"])

    def test_single_image_captioning(self):
        res = agentic_orchestrator.process_query(
            query="Describe the land-cover and major objects visible in this image",
            primary_image=self.optical_img
        )
        self.assertIn("Detected Classes", res["summary"])
        self.assertIn("Vegetation: 50.00%", res["summary"])
        self.assertIn("spectral indices are unavailable", res["summary"])

    def test_text_guided_region_grounding(self):
        res = agentic_orchestrator.process_query(
            query="Highlight the water body and locate runways referred to in the query",
            primary_image=self.optical_img
        )
        self.assertGreater(len(res["detections"]), 0)
        first_det = res["detections"][0]
        self.assertIn("box_2d", first_det)
        self.assertIn("image-relative extent", res["summary"])

    def test_cross_modal_optical_sar(self):
        res = agentic_orchestrator.process_query(
            query="Use the optical and SAR images together to identify built-up and water-covered regions.",
            primary_image=self.optical_img,
            secondary_image=self.sar_img,
            input_mode="CROSS_MODAL_PAIR"
        )
        self.assertEqual(res["task"], "IMAGE_COVERAGE_COMPARISON")
        self.assertFalse(res["statistics"]["coverageComparison"]["compatible_analysis_basis"])
        self.assertIn("were not compared", res["summary"])
        self.assertFalse(res["statistics"]["coverageComparison"]["spatial_change_detection_performed"])

    def test_bitemporal_change_vqa(self):
        res = agentic_orchestrator.process_query(
            query="Has the built-up area increased, decreased, or remained unchanged?",
            primary_image=self.optical_img,
            secondary_image=self.bitemporal_t2,
            input_mode="BITEMPORAL_PAIR"
        )
        self.assertEqual(res["task"], "IMAGE_COVERAGE_COMPARISON")
        self.assertTrue(res["statistics"]["coverageComparison"]["compatible_analysis_basis"])
        self.assertEqual(
            res["statistics"]["coverageComparison"]["difference_percentage_points"]["vegetation"],
            50.0,
        )
        self.assertIn("not pixel-aligned land conversion", res["summary"])

    def test_evaluation_criteria_normalization(self):
        eval_res = calculate_normalized_benchmark_score({
            "public-rsvqa": 0.90,
            "public-vrsbench": 0.88,
            "public-cdvqa": 0.92,
            "public-bigearthnet": 0.91,
            "isro-sac-eval": 0.95
        })
        self.assertGreaterEqual(eval_res["composite_score"], 85.0)
        self.assertEqual(len(eval_res["breakdown"]), len(EVALUATION_CRITERIA_TABLE))

if __name__ == "__main__":
    unittest.main()
