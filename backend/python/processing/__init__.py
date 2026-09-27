"""
SatQuery AI - Remote Sensing Processing Package
Houses core spectral index engines (NDVI, NDWI, NDBI, SAVI, NBR),
radiometric preprocessing, and bi-temporal change detection algorithms.
"""
from .ndvi import ndvi_processor, NDVIProcessor
from .ndwi import ndwi_processor, NDWIProcessor
from .ndbi import ndbi_processor, NDBIProcessor
from .savi import savi_nbr_processor, SAVIandNBRProcessor
from .preprocessing import preprocessor, RemoteSensingPreprocessor
from .change_detection import change_detector, ChangeDetectionProcessor

__all__ = [
    "ndvi_processor", "NDVIProcessor",
    "ndwi_processor", "NDWIProcessor",
    "ndbi_processor", "NDBIProcessor",
    "savi_nbr_processor", "SAVIandNBRProcessor",
    "preprocessor", "RemoteSensingPreprocessor",
    "change_detector", "ChangeDetectionProcessor",
]
