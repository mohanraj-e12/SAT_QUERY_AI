import base64
import io
import json
import subprocess
import sys
import unittest
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.io import MemoryFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from processing.image_analysis import analyze_satellite_image, generate_analysis_summary
from processing.topic_interpreter import (
    classify_question_intent,
    generate_pair_analysis_summary,
)


def data_uri(raw: bytes, mime: str) -> str:
    return f"data:{mime};base64,{base64.b64encode(raw).decode('ascii')}"


def rgb_image(pixels: np.ndarray) -> dict:
    output = io.BytesIO()
    Image.fromarray(pixels.astype(np.uint8), "RGB").save(output, format="PNG")
    return {
        "file_name": "uploaded-scene.png",
        "file_url": data_uri(output.getvalue(), "image/png"),
    }


def multispectral_image() -> dict:
    height, width = 8, 8
    bands = np.zeros((5, height, width), dtype=np.float32)
    bands[:, :, :2] = np.array([0.08, 0.04, 0.05, 0.01, 0.01], dtype=np.float32)[:, None, None]
    bands[:, :, 2:4] = np.array([0.10, 0.05, 0.05, 0.60, 0.30], dtype=np.float32)[:, None, None]
    bands[:, :, 4:6] = np.array([0.20, 0.20, 0.20, 0.20, 0.50], dtype=np.float32)[:, None, None]
    bands[:, :, 6:] = np.array([0.20, 0.30, 0.25, 0.25, 0.20], dtype=np.float32)[:, None, None]

    with MemoryFile() as memory_file:
        with memory_file.open(
            driver="GTiff",
            height=height,
            width=width,
            count=5,
            dtype="float32",
        ) as dataset:
            dataset.write(bands)
            dataset.set_band_description(1, "Green")
            dataset.set_band_description(2, "Red")
            dataset.set_band_description(3, "Blue")
            dataset.set_band_description(4, "NIR")
            dataset.set_band_description(5, "SWIR")
        raw = memory_file.read()

    return {
        "file_name": "multispectral.tif",
        "file_url": data_uri(raw, "image/tiff"),
        "satellite": "Test multispectral sensor",
        "bands": ["Green", "Red", "Blue", "NIR", "SWIR"],
    }


def multispectral_image_without_nir() -> dict:
    bands = np.zeros((4, 8, 8), dtype=np.float32)
    bands[0] = 0.12
    bands[1] = 0.08
    bands[2] = 0.06
    bands[3] = 0.10
    with MemoryFile() as memory_file:
        with memory_file.open(
            driver="GTiff",
            height=8,
            width=8,
            count=4,
            dtype="float32",
        ) as dataset:
            dataset.write(bands)
            for index, name in enumerate(("Green", "Red", "Blue", "SWIR"), start=1):
                dataset.set_band_description(index, name)
        raw = memory_file.read()
    return {
        "file_name": "multispectral-without-nir.tif",
        "file_url": data_uri(raw, "image/tiff"),
        "bands": ["Green", "Red", "Blue", "SWIR"],
    }


def unmapped_multiband_image() -> dict:
    bands = np.full((4, 8, 8), 0.2, dtype=np.float32)
    with MemoryFile() as memory_file:
        with memory_file.open(
            driver="GTiff",
            height=8,
            width=8,
            count=4,
            dtype="float32",
        ) as dataset:
            dataset.write(bands)
            for index in range(1, 5):
                dataset.set_band_description(index, f"Unmapped channel {index}")
        raw = memory_file.read()
    return {
        "file_name": "unmapped-multiband.tif",
        "file_url": data_uri(raw, "image/tiff"),
        "satellite": "Unknown sensor",
    }


def landsat_8_image() -> dict:
    bands = np.full((5, 8, 8), 0.2, dtype=np.float32)
    with MemoryFile() as memory_file:
        with memory_file.open(
            driver="GTiff",
            height=8,
            width=8,
            count=5,
            dtype="float32",
        ) as dataset:
            dataset.write(bands)
            for index, name in enumerate(("B3", "B4", "B2", "B5", "B6"), start=1):
                dataset.set_band_description(index, name)
        raw = memory_file.read()
    return {
        "file_name": "landsat.tif",
        "file_url": data_uri(raw, "image/tiff"),
        "satellite": "Landsat 8",
    }


class TestUploadedImageAnalysis(unittest.TestCase):
    def test_geoscope_bridge_returns_one_json_response_for_uploaded_image(self):
        pixels = np.zeros((10, 10, 3), dtype=np.uint8)
        pixels[:, :4] = [20, 60, 120]
        pixels[:, 4:] = [30, 150, 45]
        payload = {
            "action": "geoscope_analyze",
            "question": "How much water is present?",
            "image": rgb_image(pixels)["file_url"],
        }

        completed = subprocess.run(
            [sys.executable, str(Path(__file__).resolve().parents[1] / "bridge.py")],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            cwd=Path(__file__).resolve().parents[3],
            check=False,
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        response = json.loads(completed.stdout)
        self.assertTrue(response["success"], response)
        self.assertIn("GeoScope Spatial Interpretation", response["data"]["answer"])
        self.assertIn("Water", response["data"]["answer"])
        self.assertEqual(response["data"]["statistics"]["image_type"], "rgb")
        self.assertEqual(response["data"]["module_route"]["module"], "geoscope")
        self.assertTrue(response["data"]["module_result"]["narrative"])

    def test_rgb_water_and_vegetation_are_measured_from_pixels(self):
        pixels = np.zeros((10, 10, 3), dtype=np.uint8)
        pixels[:, :5] = [20, 60, 120]
        pixels[:, 5:] = [30, 150, 45]

        analysis = analyze_satellite_image(rgb_image(pixels))

        self.assertEqual(analysis["image_type"], "rgb")
        self.assertEqual(analysis["class_percentages"]["water"], 50.0)
        self.assertEqual(analysis["vegetation_percentage"], 50.0)
        self.assertFalse(analysis["ndvi_available"])
        water_answer = generate_analysis_summary("How much water is present?", analysis)
        vegetation_answer = generate_analysis_summary("How much vegetation coverage?", analysis)
        self.assertIn("50.00%", water_answer)
        self.assertIn("50.00%", vegetation_answer)
        answer = generate_analysis_summary("What is the NDVI?", analysis)
        self.assertIn("True NDVI cannot be calculated", answer)
        self.assertNotIn("Mean NDVI:", answer)

    def test_same_question_produces_different_image_derived_water_coverage(self):
        mostly_water = np.full((10, 10, 3), [20, 60, 120], dtype=np.uint8)
        mostly_vegetation = np.full((10, 10, 3), [30, 150, 45], dtype=np.uint8)

        water_result = analyze_satellite_image(rgb_image(mostly_water))
        vegetation_result = analyze_satellite_image(rgb_image(mostly_vegetation))

        self.assertGreater(water_result["class_percentages"]["water"], 95)
        self.assertLess(vegetation_result["class_percentages"]["water"], 5)
        self.assertNotEqual(
            water_result["class_percentages"]["water"],
            vegetation_result["class_percentages"]["water"],
        )
        self.assertNotEqual(
            generate_analysis_summary("How much water is present?", water_result),
            generate_analysis_summary("How much water is present?", vegetation_result),
        )

    def test_acceptance_questions_receive_distinct_question_specific_answers(self):
        pixels = np.zeros((20, 20, 3), dtype=np.uint8)
        pixels[:, :5] = [20, 60, 120]
        pixels[:, 5:10] = [30, 150, 45]
        pixels[:, 10:15] = [160, 100, 60]
        pixels[:, 15:] = [110, 110, 110]
        analysis = analyze_satellite_image(rgb_image(pixels))
        questions = (
            "Is there water?",
            "How much water is present?",
            "How much vegetation is there?",
            "What is the NDVI?",
            "What is the land cover?",
            "How much of the area is built-up?",
            "Are there buildings?",
            "Analyze agriculture in this image.",
            "Is there evidence of flooding?",
            "Give me a complete analysis.",
        )

        answers = [generate_analysis_summary(question, analysis) for question in questions]

        self.assertEqual(len(set(answers)), len(questions))
        self.assertIn("water-like pixels", answers[0])
        self.assertIn("Estimated water surface coverage", answers[1])
        self.assertIn("Vegetation-like coverage", answers[2])
        self.assertIn("True NDVI cannot be calculated", answers[3])
        self.assertIn("Land Cover Analysis", answers[4])
        self.assertIn("Built-up Analysis", answers[5])
        self.assertIn("individual-building detector", answers[6])
        self.assertIn("do not classify crop species", answers[7])
        self.assertIn("cannot confirm flooding", answers[8])
        self.assertIn("Mission Overview", answers[9])

    def test_topic_matrix_selects_relevant_measured_evidence_for_same_image(self):
        pixels = np.zeros((20, 20, 3), dtype=np.uint8)
        pixels[:, :5] = [20, 60, 120]
        pixels[:, 5:10] = [30, 150, 45]
        pixels[:, 10:15] = [160, 100, 60]
        pixels[:, 15:] = [110, 110, 110]
        analysis = analyze_satellite_image(rgb_image(pixels))
        questions = {
            "Is there water?": "water_detection",
            "How much water is present?": "water_coverage",
            "What is the vegetation coverage?": "vegetation",
            "How healthy is the vegetation?": "vegetation_health",
            "What is the NDVI?": "ndvi",
            "What is the NDWI?": "ndwi",
            "What is the land cover?": "land_cover",
            "How much built-up area is present?": "built_up",
            "Are buildings visible?": "object_detection",
            "Analyze agriculture in this image.": "agriculture",
            "Is this area flooded?": "flood",
            "Has this area experienced urban growth?": "urban_growth",
            "What has changed?": "change_detection",
            "Analyze this image completely.": "complete_analysis",
        }

        answers = []
        for question, expected_intent in questions.items():
            self.assertEqual(classify_question_intent(question), expected_intent)
            answers.append(generate_analysis_summary(question, analysis))

        self.assertEqual(len(set(answers)), len(questions))
        self.assertIn("not water level or depth", answers[1])
        self.assertIn("plant health", answers[3])
        self.assertIn("True NDWI cannot be calculated", answers[5])
        self.assertIn("single image cannot confirm flooding", answers[10])
        self.assertIn("cannot be determined from a single image", answers[11])
        self.assertIn("single-image analysis", answers[12])
        self.assertIn("**Land Cover**", answers[13])

    def test_water_vegetation_comparison_uses_only_both_relevant_coverages(self):
        pixels = np.zeros((10, 10, 3), dtype=np.uint8)
        pixels[:, :4] = [20, 60, 120]
        pixels[:, 4:] = [30, 150, 45]
        analysis = analyze_satellite_image(rgb_image(pixels))

        answer = generate_analysis_summary("Compare vegetation and water.", analysis)

        self.assertEqual(
            classify_question_intent("Compare vegetation and water."),
            "water_vegetation_comparison",
        )
        self.assertIn("Water and Vegetation Comparison", answer)
        self.assertIn("40.00%", answer)
        self.assertIn("60.00%", answer)
        self.assertNotIn("NDVI", answer)

    def test_paired_image_analysis_interprets_growth_from_measured_change(self):
        pixels_a = np.full((10, 10, 3), [110, 110, 110], dtype=np.uint8)
        pixels_a[:, :2] = [160, 100, 60]
        pixels_b = np.full((10, 10, 3), [110, 110, 110], dtype=np.uint8)
        pixels_b[:, :6] = [160, 100, 60]
        image_a = analyze_satellite_image(rgb_image(pixels_a))
        image_b = analyze_satellite_image(rgb_image(pixels_b))

        answer = generate_pair_analysis_summary(
            "Has this area experienced urban growth?",
            {**image_a, "acquisition_date": "2020-01-01"},
            {**image_b, "acquisition_date": "2024-01-01"},
            {"built_up": 40.0},
            compatible_basis=True,
        )

        self.assertIn("Urban Growth Comparison", answer)
        self.assertIn("2020-01-01", answer)
        self.assertIn("2024-01-01", answer)
        self.assertIn("increased by 40.00 percentage points", answer)
        self.assertIn("not pixel-aligned proof", answer)

    def test_multispectral_topic_answers_use_real_indices_and_health_ranges(self):
        analysis = analyze_satellite_image(multispectral_image())

        ndvi_answer = generate_analysis_summary("What is the NDVI?", analysis)
        ndwi_answer = generate_analysis_summary("What is the NDWI?", analysis)
        health_answer = generate_analysis_summary("How healthy is the vegetation?", analysis)

        self.assertIn("Mean NDVI:", ndvi_answer)
        self.assertIn("NDWI Analysis", ndwi_answer)
        self.assertIn("Mean NDVI:", health_answer)
        self.assertNotIn("cannot be calculated", ndwi_answer)

    def test_rgb_classes_sum_to_one_hundred_and_overlay_is_generated(self):
        pixels = np.zeros((10, 10, 3), dtype=np.uint8)
        pixels[:, :2] = [20, 60, 120]
        pixels[:, 2:4] = [30, 150, 45]
        pixels[:, 4:6] = [110, 110, 110]
        pixels[:, 6:8] = [160, 100, 60]
        pixels[:, 8:] = [230, 230, 230]

        analysis = analyze_satellite_image(rgb_image(pixels))

        self.assertAlmostEqual(sum(analysis["class_percentages"].values()), 100.0)
        self.assertTrue(analysis["overlays"]["land_cover"].startswith("data:image/png;base64,"))
        land_answer = generate_analysis_summary("Analyze land coverage", analysis)
        self.assertIn("- Vegetation:", land_answer)
        self.assertIn("- Built-up:", land_answer)
        self.assertIn("- Other:", land_answer)
        complete_answer = generate_analysis_summary("Analyze this satellite image", analysis)
        for class_name in ("Vegetation", "Water", "Built-up", "Bare land", "Other"):
            self.assertIn(f"- {class_name}:", complete_answer)

    def test_multispectral_ndvi_and_water_indices_use_named_bands(self):
        analysis = analyze_satellite_image(multispectral_image())

        self.assertEqual(analysis["image_type"], "multispectral")
        self.assertTrue(analysis["ndvi_available"])
        self.assertEqual(analysis["band_mapping"], {"green": 1, "red": 2, "blue": 3, "nir": 4, "swir": 5})
        self.assertGreater(analysis["indices"]["ndvi"]["maximum"], 0.84)
        self.assertEqual(analysis["class_percentages"]["water"], 25.0)
        self.assertEqual(analysis["vegetation_percentage"], 25.0)
        self.assertEqual(analysis["class_percentages"]["built_up"], 25.0)
        for key in ("ndvi", "mndwi", "ndbi"):
            self.assertTrue(analysis["overlays"][key].startswith("data:image/png;base64,"))
        answer = generate_analysis_summary("What is the NDVI?", analysis)
        self.assertIn("Mean", answer)
        self.assertNotIn("cannot be calculated", answer)
        water_answer = generate_analysis_summary("How much water is present?", analysis)
        self.assertIn("25.00%", water_answer)
        self.assertIn("MNDWI", water_answer)

    def test_multispectral_without_red_and_nir_does_not_report_ndvi(self):
        analysis = analyze_satellite_image(multispectral_image_without_nir())

        self.assertEqual(analysis["image_type"], "multispectral")
        self.assertFalse(analysis["ndvi_available"])
        answer = generate_analysis_summary("What is the NDVI?", analysis)
        self.assertIn("mapped Red and near-infrared bands are unavailable", answer)
        self.assertNotIn("Mean NDVI:", answer)
        health_answer = generate_analysis_summary("How healthy is the vegetation?", analysis)
        self.assertIn("mapped Red and near-infrared bands are unavailable", health_answer)
        self.assertNotIn("RGB image", health_answer)

    def test_unmapped_multiband_raster_does_not_report_zero_land_cover(self):
        analysis = analyze_satellite_image(unmapped_multiband_image())

        self.assertFalse(any(analysis["class_availability"].values()))
        self.assertTrue(all(value is None for value in analysis["class_percentages"].values()))
        self.assertIsNone(analysis["water_detected"])
        overlay = Image.open(io.BytesIO(base64.b64decode(analysis["overlays"]["land_cover"].split(",", 1)[1])))
        self.assertFalse(np.any(np.asarray(overlay)[:, :, 3]))
        answer = generate_analysis_summary("How much water is present?", analysis)
        self.assertIn("Water coverage is unavailable", answer)
        self.assertNotIn("0.00%", answer)

    def test_landsat_platform_names_with_spaces_map_band_roles(self):
        analysis = analyze_satellite_image(landsat_8_image())

        self.assertEqual(
            analysis["band_mapping"],
            {"green": 1, "red": 2, "blue": 3, "nir": 4, "swir": 5},
        )
        self.assertTrue(analysis["ndvi_available"])

    def test_integer_geotiff_with_nodata_is_decoded_for_real_indices(self):
        bands = np.zeros((5, 8, 8), dtype=np.int16)
        bands[0] = 800
        bands[1] = 200
        bands[2] = 300
        bands[3] = 700
        bands[4] = 100
        bands[:, 0, 0] = 0
        with MemoryFile() as memory_file:
            with memory_file.open(
                driver="GTiff",
                height=8,
                width=8,
                count=5,
                dtype="int16",
                nodata=0,
            ) as dataset:
                dataset.write(bands)
                for index, name in enumerate(("Green", "Red", "Blue", "NIR", "SWIR"), start=1):
                    dataset.set_band_description(index, name)
            raw = memory_file.read()

        analysis = analyze_satellite_image({
            "file_name": "integer-scene.tif",
            "file_url": data_uri(raw, "image/tiff"),
        })

        self.assertTrue(analysis["ndvi_available"])
        self.assertEqual(analysis["valid_pixel_count"], 63)
        self.assertAlmostEqual(analysis["indices"]["ndvi"]["mean"], 0.556, places=2)

    def test_rgb_geotiff_reflectance_is_scaled_before_color_classification(self):
        bands = np.zeros((3, 8, 8), dtype=np.float32)
        bands[0, :, :4] = 0.10
        bands[1, :, :4] = 0.50
        bands[2, :, :4] = 0.10
        bands[:, :, 4:] = 0.30
        with MemoryFile() as memory_file:
            with memory_file.open(
                driver="GTiff",
                height=8,
                width=8,
                count=3,
                dtype="float32",
            ) as dataset:
                dataset.write(bands)
                for index, name in enumerate(("Red", "Green", "Blue"), start=1):
                    dataset.set_band_description(index, name)
            raw = memory_file.read()

        analysis = analyze_satellite_image({
            "file_name": "rgb-reflectance.tif",
            "file_url": data_uri(raw, "image/tiff"),
        })

        self.assertEqual(analysis["image_type"], "rgb")
        self.assertEqual(analysis["class_percentages"]["vegetation"], 50.0)
        self.assertEqual(analysis["class_percentages"]["water"], 0.0)

    def test_unavailable_image_data_fails_instead_of_returning_synthetic_metrics(self):
        with self.assertRaisesRegex(ValueError, "uploaded image data is unavailable"):
            analyze_satellite_image({"file_name": "missing.png"})


if __name__ == "__main__":
    unittest.main()
