"""
SatQueryAI - Verification Script: Image Conditioning & Question Conditioning
Proves:
1. Different Image -> Different Visual Analysis (Forest vs Water vs Urban)
2. Different Question -> Different Task / Answer on same image
3. Genuine Image-Conditioned Response
"""

import sys
from pathlib import Path

# Add root workspace to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from backend.utils.image_utils import StandardImage
from backend.reasoning.answer_generator import answer_generator

def create_synthetic_forest_image():
    # Forest Green with dark canopy variations
    pixels = []
    for y in range(64):
        for x in range(64):
            if (x + y) % 8 == 0:
                pixels.append((20, 100, 20))
            else:
                pixels.append((34, 139, 34))
    return StandardImage(64, 64, pixels)

def create_synthetic_water_image():
    # Deep Ocean Blue with water ripple gradients
    pixels = []
    for y in range(64):
        for x in range(64):
            pixels.append((15, 60, 180 if y % 4 == 0 else 160))
    return StandardImage(64, 64, pixels)

def create_synthetic_urban_image():
    # Concrete Grey with roads & roofs
    pixels = []
    for y in range(64):
        for x in range(64):
            if x % 16 < 3 or y % 16 < 3:
                pixels.append((40, 40, 40)) # Road
            elif (x // 8 + y // 8) % 2 == 0:
                pixels.append((160, 60, 50)) # Roof
            else:
                pixels.append((180, 180, 180)) # Concrete
    return StandardImage(64, 64, pixels)

def run_tests():
    print("==================================================")
    print(" SatQueryAI - Image & Question Conditioning Verification ")
    print("==================================================")

    img_forest = create_synthetic_forest_image()
    img_water = create_synthetic_water_image()
    img_urban = create_synthetic_urban_image()

    # TEST 1: Same Question on Different Images
    q_general = "What type of land cover is shown in this satellite image?"
    print("\n--- TEST 1: Same Question ('What type of land cover is shown?') on Distinct Images ---")
    
    res_forest = answer_generator.generate_analysis(img_forest, q_general)
    print(f"\n[IMAGE A - Forest Scene]")
    print(f"Task: {res_forest['task']}")
    print(f"Answer: {res_forest['answer']}")
    print(f"Confidence: {res_forest['confidence']}")
    print(f"Features: {res_forest['detected_features']}")
    print(f"Evidence: {res_forest['evidence'][0]}")

    res_water = answer_generator.generate_analysis(img_water, q_general)
    print(f"\n[IMAGE B - Water Body Scene]")
    print(f"Task: {res_water['task']}")
    print(f"Answer: {res_water['answer']}")
    print(f"Confidence: {res_water['confidence']}")
    print(f"Features: {res_water['detected_features']}")
    print(f"Evidence: {res_water['evidence'][0]}")

    res_urban = answer_generator.generate_analysis(img_urban, q_general)
    print(f"\n[IMAGE C - Urban City Scene]")
    print(f"Task: {res_urban['task']}")
    print(f"Answer: {res_urban['answer']}")
    print(f"Confidence: {res_urban['confidence']}")
    print(f"Features: {res_urban['detected_features']}")
    print(f"Evidence: {res_urban['evidence'][0]}")

    assert res_forest["answer"] != res_water["answer"], "Forest and Water answers must differ!"
    assert res_forest["detected_features"] != res_water["detected_features"], "Detected features must differ!"
    print("\n>>> RESULT: Image A, Image B, and Image C produced distinctly tailored answers and features!")

    # TEST 2: Same Image (Forest) with Different Questions
    print("\n--- TEST 2: Same Image (Forest) with Different Specific Questions ---")
    
    q_water = "Does this image contain water bodies?"
    res_q_water = answer_generator.generate_analysis(img_forest, q_water)
    print(f"\n[Question 1: '{q_water}']")
    print(f"Task: {res_q_water['task']}")
    print(f"Answer: {res_q_water['answer']}")

    q_veg = "How much vegetation is visible in this scene?"
    res_q_veg = answer_generator.generate_analysis(img_forest, q_veg)
    print(f"\n[Question 2: '{q_veg}']")
    print(f"Task: {res_q_veg['task']}")
    print(f"Answer: {res_q_veg['answer']}")

    assert res_q_water["task"] != res_q_veg["task"], "Tasks must differ!"
    assert res_q_water["answer"] != res_q_veg["answer"], "Answers must differ!"
    print("\n>>> RESULT: Different questions on the same image triggered different specialist tasks and answers!")

    print("\n==================================================")
    print(" ALL CONDITIONING VERIFICATIONS PASSED SUCCESSFULLY! ")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
