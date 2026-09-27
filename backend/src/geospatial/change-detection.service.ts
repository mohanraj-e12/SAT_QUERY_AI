import { ChangeDetectionResult, SatelliteImage } from '../models/types.js';
import { pixelAnalyzerService } from './pixel-analyzer.service.js';

export class ChangeDetectionService {
  /**
   * Run bi-temporal comparative analysis between two satellite images
   */
  public async compareImages(
    imageBefore: SatelliteImage,
    imageAfter: SatelliteImage,
    beforeBase64?: string,
    afterBase64?: string
  ): Promise<ChangeDetectionResult> {
    const comparison = await pixelAnalyzerService.compareImages(
      imageBefore,
      imageAfter,
      beforeBase64,
      afterBase64
    );

    return {
      beforeImageId: imageBefore.id,
      afterImageId: imageAfter.id,
      beforeDate: imageBefore.acquisition_date ?? 'Unknown',
      afterDate: imageAfter.acquisition_date ?? 'Unknown',
      builtUpChangePercentage: comparison.builtUpChangePercentage,
      vegetationChangePercentage: comparison.vegetationChangePercentage,
      waterChangePercentage: comparison.waterChangePercentage,
      bareSoilChangePercentage: comparison.bareSoilChangePercentage,
      netChangedAreaHa: comparison.netChangedAreaHa,
      confidence: comparison.confidence,
      aiExplanation: comparison.aiExplanation,
      landImprovementStatus: comparison.landImprovementStatus,
      landImprovementLabel: comparison.landImprovementLabel,
      landImprovementDescription: comparison.landImprovementDescription,
      landImprovementScore: comparison.landImprovementScore,
      deltaNdvi: comparison.deltaNdvi,
      deltaNdwi: comparison.deltaNdwi,
      deltaNdbi: comparison.deltaNdbi,
      environmentalFactors: comparison.environmentalFactors,
      transitions: comparison.transitions,
      changeRegions: comparison.changeRegions,
    };
  }
}

export const changeDetectionService = new ChangeDetectionService();
