import { AnalysisType } from '../models/types.js';

export interface QueryRouteDecision {
  analysisType: AnalysisType;
  confidence: number;
  reasoning: string;
  suggestedBands: string[];
  spectralIndex?: 'NDVI' | 'NDWI' | 'NDBI';
}

export class QueryRouterService {
  /**
   * Parse user natural-language query and route to the optimal remote-sensing analysis pipeline
   */
  public routeQuery(query: string): QueryRouteDecision {
    const q = query.toLowerCase().trim();

    // 1. Change Detection
    if (
      q.includes('change') ||
      q.includes('compare') ||
      q.includes('difference') ||
      q.includes('two images') ||
      q.includes('before and after') ||
      q.includes('temporal') ||
      q.includes('expanded') ||
      q.includes('decreased')
    ) {
      return {
        analysisType: 'CHANGE_DETECTION',
        confidence: 0.95,
        reasoning: 'Query requires bi-temporal comparative analysis and difference vector mapping between multi-date acquisitions.',
        suggestedBands: ['B4 (Red)', 'B8 (NIR)', 'B11 (SWIR)'],
      };
    }

    // 2. Vegetation Analysis
    if (
      q.includes('vegetat') ||
      q.includes('green') ||
      q.includes('forest') ||
      q.includes('tree') ||
      q.includes('deforest') ||
      q.includes('crop') ||
      q.includes('agriculture') ||
      q.includes('farm') ||
      q.includes('canopy') ||
      q.includes('chlorophyll') ||
      q.includes('ndvi')
    ) {
      return {
        analysisType: 'VEGETATION',
        confidence: 0.96,
        reasoning: 'Query focuses on vegetative vigor, canopy cover, and green biomass density, triggering the Normalized Difference Vegetation Index (NDVI).',
        suggestedBands: ['B4 (Red)', 'B8 (NIR)'],
        spectralIndex: 'NDVI',
      };
    }

    // 3. Water Body Detection
    if (
      q.includes('water') ||
      q.includes('river') ||
      q.includes('lake') ||
      q.includes('reservoir') ||
      q.includes('flood') ||
      q.includes('pond') ||
      q.includes('ocean') ||
      q.includes('sea') ||
      q.includes('glacier lake') ||
      q.includes('ndwi')
    ) {
      return {
        analysisType: 'WATER_DETECTION',
        confidence: 0.94,
        reasoning: 'Query demands delineation of open water surface bodies and inundation boundaries using the Normalized Difference Water Index (NDWI).',
        suggestedBands: ['B3 (Green)', 'B8 (NIR)'],
        spectralIndex: 'NDWI',
      };
    }

    // 4. Object Detection (Buildings, aircraft, vessels, tanks)
    if (
      q.includes('building') ||
      q.includes('house') ||
      q.includes('aircraft') ||
      q.includes('airplane') ||
      q.includes('plane') ||
      q.includes('ship') ||
      q.includes('vessel') ||
      q.includes('boat') ||
      q.includes('vehicle') ||
      q.includes('tank') ||
      q.includes('runway') ||
      q.includes('solar') ||
      q.includes('detect object') ||
      q.includes('identify building')
    ) {
      return {
        analysisType: 'OBJECT_DETECTION',
        confidence: 0.93,
        reasoning: 'Query targets discrete spatial target features and structures requiring vision-language multimodal spatial bounding-box localization.',
        suggestedBands: ['B2 (Blue)', 'B3 (Green)', 'B4 (Red)', 'Pan'],
      };
    }

    // 5. Built-up / Urban Expansion (NDBI)
    if (
      q.includes('built-up') ||
      q.includes('built up') ||
      q.includes('urban') ||
      q.includes('city') ||
      q.includes('road') ||
      q.includes('highway') ||
      q.includes('impervious') ||
      q.includes('concrete') ||
      q.includes('asphalt') ||
      q.includes('ndbi')
    ) {
      return {
        analysisType: 'BUILT_UP_ANALYSIS',
        confidence: 0.92,
        reasoning: 'Query evaluates anthropogenic land-cover expansion and impervious surfaces, routed to Normalized Difference Built-up Index (NDBI).',
        suggestedBands: ['B8 (NIR)', 'B11 (SWIR-1)'],
        spectralIndex: 'NDBI',
      };
    }

    // 6. Multimodal Vision-Language Scene Description
    return {
      analysisType: 'IMAGE_DESCRIPTION',
      confidence: 0.88,
      reasoning: 'General exploratory geospatial query routed to holistic multimodal vision-language scene breakdown and land-use categorization.',
      suggestedBands: ['RGB Composite', 'B8 (NIR)'],
    };
  }
}

export const queryRouterService = new QueryRouterService();
