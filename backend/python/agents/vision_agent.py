"""
SatQuery AI - Vision Agent
Integrates remote-sensing foundation models (Vision-Language Transformers, CLIP-RS,
SegFormer semantic segmentation, U-Net, and SAM spatial prompting) for multimodal imagery.
"""
from typing import Dict, Any, List, Optional
try:
    from models.bigearthnet_vlm import BigEarthNetVLM
    from models.rsvqa_vrsbench import RSVQAandVRSBenchSpecialist
    from models.rs_grounding import RSGroundingSpecialist
    from models.optical_sar_fusion import OpticalSARFusionSpecialist
except ImportError:
    from backend.python.models.bigearthnet_vlm import BigEarthNetVLM
    from backend.python.models.rsvqa_vrsbench import RSVQAandVRSBenchSpecialist
    from backend.python.models.rs_grounding import RSGroundingSpecialist
    from backend.python.models.optical_sar_fusion import OpticalSARFusionSpecialist

class RemoteSensingVisionAgent:
    """
    Executes vision-language inference, segmentation, and target object detection.
    """
    def __init__(self):
        self.bigearthnet_vlm = BigEarthNetVLM()
        self.rsvqa_vrsbench = RSVQAandVRSBenchSpecialist()
        self.grounding = RSGroundingSpecialist()
        self.optical_sar_fusion = OpticalSARFusionSpecialist()

    def inspect_scene(
        self,
        query: str,
        image_metadata: Dict[str, Any],
        task_mode: str = "VQA" # "VQA", "CAPTION", "GROUND", or "CLASSIFICATION"
    ) -> Dict[str, Any]:
        """
        Routes query to the optimal vision architecture.
        """
        if task_mode == "CAPTION":
            return self.rsvqa_vrsbench.generate_caption(image_metadata)
        elif task_mode == "GROUND":
            return self.grounding.ground_objects(query, image_metadata)
        elif task_mode == "CLASSIFICATION":
            return self.bigearthnet_vlm.classify_scene(image_metadata)
        else:
            return self.rsvqa_vrsbench.answer_vqa(query, image_metadata)

    def cross_modal_fusion_inspection(
        self,
        query: str,
        optical_image: Dict[str, Any],
        sar_image: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Executes joint optical-SAR vision reasoning.
        """
        return self.optical_sar_fusion.fuse_and_analyze(query, optical_image, sar_image)

vision_agent = RemoteSensingVisionAgent()
