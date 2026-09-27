"""
SatQueryAI - Remote Sensing Classifier
Classifies satellite imagery into Corine Land Cover (CLC-19) / BigEarthNet classes.
"""

from typing import Dict, Any, List
from backend.utils.image_utils import extract_visual_features
from backend.retrieval.bigearthnet import bigearthnet_retriever, BIGEARTHNET_19_CLASSES

class RemoteSensingClassifier:
    """
    Multi-label land-cover classifier calibrated with BigEarthNet v2.0 taxonomy.
    """

    def classify(self, image_pil: Any) -> Dict[str, Any]:
        features = extract_visual_features(image_pil)
        retrieved = bigearthnet_retriever.retrieve_similar_patches(image_pil, top_k=3, split_filter="train")

        veg = features.get("vegetation_pct", 0)
        water = features.get("water_pct", 0)
        urban = features.get("urban_pct", 0)
        barren = features.get("barren_pct", 0)
        edge_density = features.get("edge_density", 0)

        class_probabilities: Dict[str, float] = {}
        for cls_name in BIGEARTHNET_19_CLASSES:
            score = 0.05
            if "forest" in cls_name.lower() or "woodland" in cls_name.lower():
                score = min(0.95, (veg / 100.0) * 0.9 + 0.05)
            elif "water" in cls_name.lower() or "wetland" in cls_name.lower():
                score = min(0.95, (water / 100.0) * 0.95 + 0.02)
            elif "urban" in cls_name.lower() or "commercial" in cls_name.lower():
                score = min(0.95, (urban / 100.0) * 0.7 + (edge_density * 0.5) + 0.05)
            elif "arable" in cls_name.lower() or "pasture" in cls_name.lower() or "agriculture" in cls_name.lower():
                score = min(0.95, (veg / 100.0) * 0.5 + (edge_density * 0.3) + 0.05)
            elif "beaches" in cls_name.lower() or "sand" in cls_name.lower():
                score = min(0.90, (barren / 100.0) * 0.8 + 0.02)

            class_probabilities[cls_name] = round(score, 3)

        sorted_classes = sorted(class_probabilities.items(), key=lambda x: x[1], reverse=True)
        top_class, top_prob = sorted_classes[0]

        return {
            "primary_class": top_class,
            "confidence": top_prob,
            "all_classes": class_probabilities,
            "top_predictions": [{"class": c, "confidence": p} for c, p in sorted_classes[:5]],
            "nearest_references": retrieved
        }

remote_sensing_classifier = RemoteSensingClassifier()
