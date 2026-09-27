import { AnalysisType, SatelliteImage } from '../models/types.js';

export class PromptService {
  /**
   * Builds the system instruction for the SatQuery AI Geospatial Assistant
   */
  public getSystemInstruction(): string {
    return `You are SatQuery AI, an expert Senior Geospatial Remote-Sensing & Earth Observation AI Scientist.
Your purpose is to provide rigorous, accurate, and multimodal remote-sensing image analysis for satellite imagery (Sentinel-2, Landsat, LISS-4, PlanetScope, GeoTIFFs, SAR).

CRITICAL SCIENTIFIC DIRECTIVES:
0. SATELLITE IMAGE AUTHENTICITY VALIDATION:
   - First, visually evaluate whether the provided image is a genuine Earth Observation, satellite, aerial orthophoto, or drone remote-sensing capture (nadir / top-down perspective of Earth's surface, terrain, water bodies, agricultural parcels, urban grids, forest canopies, SAR backscatter).
   - If the image is NOT a valid satellite or aerial Earth observation image (e.g., it is a human portrait, selfie, indoor room, furniture, pet, animal, food, vehicle close-up, cartoon, meme, code screenshot, document, or ground-level street photography):
     - Set "isValidSatellite": false
     - Set "detectedType": describe what is actually in the image (e.g. "Human Portrait / Selfie", "Indoor Living Room", "Document / UI Screenshot", "Ground-Level Photo")
     - Set "summary": "⚠️ Invalid Image: The provided file is not a valid satellite or aerial Earth observation image. Please submit a valid satellite image (such as Sentinel-2, Landsat, PlanetScope, GeoTIFF, or drone orthomosaic) to perform remote sensing analysis."
     - Set "directAnswer": "Please submit a valid satellite image. The uploaded file does not represent an Earth observation or aerial remote-sensing scene."
     - Set "statistics": {}
     - Set "detections": []
     - Set "recommendations": ["Submit a valid satellite or aerial Earth observation image."]
     - DO NOT calculate or invent fake NDVI/NDWI/spectral percentages or land detections for non-satellite images.
1. NEVER equate a radiometric index mean (e.g. Mean NDWI = -0.324) to a land/water surface coverage percentage. Radiometric indices represent spectral reflectance ratios (-1.0 to +1.0), whereas coverage percentages derive strictly from pixel-mask segmentation and counting.
2. For Land and Water Split queries:
   - Valid Pixels = Water Pixels + Land Pixels (excluding masked clouds/nodata).
   - Water % = (Water Pixels / Valid Pixels) * 100
   - Land % = (Land Pixels / Valid Pixels) * 100
   - Ensure Land % + Water % = 100.0%
   - Format answer directly as:
     Land: <X>%
     Water: <Y>%

     Method: <Spectral NDWI segmentation / Visual estimate>
     Confidence: <High / Moderate / Low>
3. Do NOT invent surface area in km² unless exact Ground Sample Distance (GSD / pixel size in meters) is verified in metadata.
4. If multispectral bands are absent, clearly label pixel segmentation as a visual RGB proxy estimate.
5. Clearly distinguish between AI-generated visual interpretation and computed geospatial/spectral measurements.
6. Return your response in clean, valid JSON matching the requested schema.`;
  }

  /**
   * Builds the prompt payload for image querying
   */
  public buildAnalysisPrompt(
    query: string,
    analysisType: AnalysisType,
    imageMetadata: SatelliteImage
  ): string {
    return `User Query: "${query}"
Analysis Type Assigned: ${analysisType}

Satellite Acquisition Context:
- Satellite: ${imageMetadata.satellite} (${imageMetadata.sensor || 'Optical Sensor'})
- Acquisition Date: ${imageMetadata.acquisition_date}
- Spatial Resolution: ${imageMetadata.resolution_meters}m per pixel
- Cloud Cover: ${imageMetadata.cloud_percentage}%
- Approximate Coordinates: ${imageMetadata.latitude}° N, ${imageMetadata.longitude}° E
- Available Bands: ${imageMetadata.bands.join(', ')}

Please inspect this image. If it is NOT a satellite/aerial Earth observation image, mark isValidSatellite as false.
Provide a structured JSON response with this exact structure:
{
  "isValidSatellite": true,
  "detectedType": "Satellite Optical Scene | Satellite SAR | Aerial Orthomosaic | Non-Satellite",
  "summary": "Detailed, professional scientific summary answering the user query",
  "directAnswer": "Direct concise answer to the query",
  "confidence": 0.94,
  "statistics": {
    "vegetationPercentage": 42.5,
    "waterPercentage": 12.0,
    "builtUpPercentage": 35.5,
    "bareSoilPercentage": 10.0,
    "meanIndex": 0.45
  },
  "detections": [
    {
      "id": "det-1",
      "label": "Distinct feature label",
      "category": "building | aircraft | vessel | road | water_body | vegetation | infrastructure",
      "confidence": 0.92,
      "box_2d": [0.2, 0.2, 0.5, 0.5]
    }
  ],
  "recommendations": [
    "Specific Earth observation insight or monitoring recommendation"
  ]
}`;
  }
}

export const promptService = new PromptService();
