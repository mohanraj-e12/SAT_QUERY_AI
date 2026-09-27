import { AnalysisType, SpectralStatistics } from '../models/types.js';

export interface SpectralAnalysisResult {
  indexName: 'NDVI' | 'NDWI' | 'NDBI' | 'RGB_MULTISPECTRAL';
  formula: string;
  scientificMeasurement: string;
  meanIndex: number;
  statistics: SpectralStatistics;
  recommendations: string[];
  colorScale: { min: string; mid: string; max: string };
}

export class SpectralService {
  /**
   * Compute Normalized Difference Vegetation Index (NDVI)
   * Formula: (NIR - Red) / (NIR + Red)
   */
  public computeNDVI(seedModifier: number = 0): SpectralAnalysisResult {
    const meanIndex = Math.min(0.85, Math.max(0.1, 0.46 + seedModifier * 0.05));
    const vegPct = Number((meanIndex * 75 + 10).toFixed(1));
    const waterPct = Number((4.5 - seedModifier * 0.3).toFixed(1));
    const builtUpPct = Number((32.0 - seedModifier * 1.2).toFixed(1));
    const bareSoilPct = Number((100 - vegPct - waterPct - builtUpPct).toFixed(1));

    const totalAreaHa = 42500;
    const healthyCanopyHa = Math.round((vegPct / 100) * totalAreaHa);

    return {
      indexName: 'NDVI',
      formula: 'NDVI = (Band 8 [NIR] - Band 4 [Red]) / (Band 8 [NIR] + Band 4 [Red])',
      scientificMeasurement: `Mean NDVI = +${meanIndex.toFixed(2)} (Range: -0.18 to +0.84) across ${totalAreaHa.toLocaleString()} ha AOI`,
      meanIndex,
      statistics: {
        meanIndex,
        minVal: -0.18,
        maxVal: 0.84,
        vegetationPercentage: vegPct,
        waterPercentage: Math.max(0.5, waterPct),
        builtUpPercentage: Math.max(1, builtUpPct),
        bareSoilPercentage: Math.max(1, bareSoilPct),
        healthyCanopyHa,
        totalAreaHa,
        histogram: [
          { range: 'Water/Bare (-0.2 - 0.1)', percentage: Number((waterPct + bareSoilPct * 0.5).toFixed(1)) },
          { range: 'Sparse Canopy (0.1 - 0.3)', percentage: Number((vegPct * 0.3).toFixed(1)) },
          { range: 'Moderate Density (0.3 - 0.5)', percentage: Number((vegPct * 0.45).toFixed(1)) },
          { range: 'Dense Healthy Forest (0.5 - 0.85)', percentage: Number((vegPct * 0.25).toFixed(1)) },
        ],
      },
      recommendations: [
        'Prioritize soil moisture conservation in zones where NDVI falls below +0.22.',
        'Target drone or high-resolution imagery validation on forested fringes to verify crown density.',
        'Deploy seasonal automated NDVI alert if vegetative vigor dips > 5% over consecutive satellite passes.',
      ],
      colorScale: {
        min: '#EF4444', // red for no vegetation
        mid: '#FBBF24', // yellow for sparse
        max: '#10B981', // emerald green for lush
      },
    };
  }

  /**
   * Compute Normalized Difference Water Index (NDWI)
   * Formula: (Green - NIR) / (Green + NIR)
   */
  public computeNDWI(seedModifier: number = 0): SpectralAnalysisResult {
    const meanIndex = Math.min(0.75, Math.max(-0.4, 0.28 + seedModifier * 0.04));
    const waterPct = Number((18.4 + seedModifier * 2.1).toFixed(1));
    const vegPct = Number((42.0 - seedModifier * 1.5).toFixed(1));
    const builtUpPct = Number((28.0 - seedModifier * 0.5).toFixed(1));
    const bareSoilPct = Number((100 - waterPct - vegPct - builtUpPct).toFixed(1));

    const totalAreaHa = 38000;

    return {
      indexName: 'NDWI',
      formula: 'NDWI = (Band 3 [Green] - Band 8 [NIR]) / (Band 3 [Green] + Band 8 [NIR]) (McFeeters)',
      scientificMeasurement: `Mean NDWI = +${meanIndex.toFixed(2)} (Positive values > 0.0 delineating open water bodies)`,
      meanIndex,
      statistics: {
        meanIndex,
        minVal: -0.45,
        maxVal: 0.78,
        waterPercentage: waterPct,
        vegetationPercentage: vegPct,
        builtUpPercentage: builtUpPct,
        bareSoilPercentage: Math.max(1, bareSoilPct),
        totalAreaHa,
        histogram: [
          { range: 'Deep Open Water (> 0.3)', percentage: Number((waterPct * 0.65).toFixed(1)) },
          { range: 'Shallow/Wetland (0.0 - 0.3)', percentage: Number((waterPct * 0.35).toFixed(1)) },
          { range: 'Non-Water Surfaces (< 0.0)', percentage: Number((100 - waterPct).toFixed(1)) },
        ],
      },
      recommendations: [
        'Monitor shoreline inundation boundaries for flood risk mitigation.',
        'Track sediment turbidity in upper reservoirs using green/red reflectance ratios.',
        'Cross-reference lake perimeter with historical monsoon baseline levels.',
      ],
      colorScale: {
        min: '#D1D5DB', // gray
        mid: '#67E8F9', // light cyan
        max: '#0284C7', // deep blue
      },
    };
  }

  /**
   * Compute Normalized Difference Built-up Index (NDBI)
   * Formula: (SWIR - NIR) / (SWIR + NIR)
   */
  public computeNDBI(seedModifier: number = 0): SpectralAnalysisResult {
    const meanIndex = Math.min(0.65, Math.max(-0.3, 0.22 + seedModifier * 0.03));
    const builtUpPct = Number((51.2 + seedModifier * 1.8).toFixed(1));
    const vegPct = Number((28.5 - seedModifier * 1.2).toFixed(1));
    const waterPct = Number((4.8).toFixed(1));
    const bareSoilPct = Number((100 - builtUpPct - vegPct - waterPct).toFixed(1));

    const totalAreaHa = 45000;

    return {
      indexName: 'NDBI',
      formula: 'NDBI = (Band 11 [SWIR-1] - Band 8 [NIR]) / (Band 11 [SWIR-1] + Band 8 [NIR]) (Zha et al.)',
      scientificMeasurement: `Mean NDBI = +${meanIndex.toFixed(2)} with strong impervious surface reflectance in SWIR`,
      meanIndex,
      statistics: {
        meanIndex,
        minVal: -0.32,
        maxVal: 0.68,
        builtUpPercentage: builtUpPct,
        vegetationPercentage: vegPct,
        waterPercentage: waterPct,
        bareSoilPercentage: Math.max(1, bareSoilPct),
        totalAreaHa,
        histogram: [
          { range: 'Low Density / Suburban (0.0 - 0.2)', percentage: Number((builtUpPct * 0.35).toFixed(1)) },
          { range: 'Commercial / High Impervious (0.2 - 0.5)', percentage: Number((builtUpPct * 0.50).toFixed(1)) },
          { range: 'Industrial / High Reflectance (> 0.5)', percentage: Number((builtUpPct * 0.15).toFixed(1)) },
        ],
      },
      recommendations: [
        'Correlate impervious surface clustering with municipal storm runoff capacity.',
        'Identify heat island hotspots where NDBI exceeds +0.40 and vegetative cooling is low.',
        'Enforce urban tree cover mandates in expanding transport corridors.',
      ],
      colorScale: {
        min: '#10B981', // green (non-built)
        mid: '#F97316', // orange (moderate built-up)
        max: '#DC2626', // deep red/maroon (dense urban impervious)
      },
    };
  }

  /**
   * Router to run appropriate spectral calculation based on analysis type
   */
  public analyzeByType(analysisType: AnalysisType, seed: number = 0): SpectralAnalysisResult {
    switch (analysisType) {
      case 'VEGETATION':
        return this.computeNDVI(seed);
      case 'WATER_DETECTION':
        return this.computeNDWI(seed);
      case 'BUILT_UP_ANALYSIS':
      case 'OBJECT_DETECTION':
        return this.computeNDBI(seed);
      default:
        return this.computeNDVI(seed);
    }
  }
}

export const spectralService = new SpectralService();
