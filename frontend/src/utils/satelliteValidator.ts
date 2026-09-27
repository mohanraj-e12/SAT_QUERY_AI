/**
 * Satellite Image Pre-Validation and Authenticity Verification Engine
 * Audits Earth observation imagery authenticity across client and backend API.
 */

export interface ClientValidationResult {
  status: 'VALID' | 'INVALID' | 'UNAVAILABLE';
  isValid: boolean;
  isAuthentic: boolean;
  detectedType: string;
  confidence?: number;
  reason?: string;
  suggestedAction?: string;
  errorMessage?: string;
}

/**
 * Fast client-side heuristic pre-check
 */
export const validateClientImage = (file: File): Promise<ClientValidationResult> => {
  return new Promise((resolve) => {
    const name = (file.name || '').toLowerCase();

    // 1. Explicitly check for blacklisted non-geospatial keywords
    const explicitNonSatelliteKeywords = [
      'selfie',
      'portrait',
      'my_face',
      'headshot',
      'receipt',
      'invoice',
      'resume',
      'cv_photo',
      'meme',
      'cat_photo',
      'dog_photo',
    ];

    for (const kw of explicitNonSatelliteKeywords) {
      if (name.includes(kw)) {
        resolve({
          status: 'INVALID',
          isValid: false,
          isAuthentic: false,
          detectedType: `Non-Geospatial Asset (${kw})`,
          reason: `Filename contains non-satellite keyword '${kw}'.`,
          suggestedAction: 'Please select an authentic satellite, aerial, or drone Earth observation scene.',
        });
        return;
      }
    }

    // 2. Quick sanity check on canvas to detect completely blank/solid dummy files
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve({
            status: 'VALID',
            isValid: true,
            isAuthentic: true,
            detectedType: 'Earth Observation / Satellite Scene',
          });
          return;
        }

        canvas.width = 64;
        canvas.height = 64;
        ctx.drawImage(img, 0, 0, 64, 64);
        const imgData = ctx.getImageData(0, 0, 64, 64).data;
        URL.revokeObjectURL(url);

        let pureWhiteCount = 0;
        let pureBlackCount = 0;
        const totalSampled = 64 * 64;

        for (let i = 0; i < totalSampled; i++) {
          const idx = i * 4;
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];

          if (r > 252 && g > 252 && b > 252) pureWhiteCount++;
          if (r < 3 && g < 3 && b < 3) pureBlackCount++;
        }

        // Reject if literally 95%+ solid white or black
        if (pureWhiteCount / totalSampled > 0.95 || pureBlackCount / totalSampled > 0.95) {
          resolve({
            status: 'INVALID',
            isValid: false,
            isAuthentic: false,
            detectedType: 'Blank / Solid Color Canvas',
            reason: 'Image is almost entirely solid blank pixels.',
            suggestedAction: 'Please submit a valid satellite or aerial Earth observation image.',
          });
          return;
        }

        resolve({
          status: 'VALID',
          isValid: true,
          isAuthentic: true,
          detectedType: 'Earth Observation / Satellite Scene',
        });
      } catch {
        URL.revokeObjectURL(url);
        resolve({
          status: 'VALID',
          isValid: true,
          isAuthentic: true,
          detectedType: 'Earth Observation / Satellite Scene',
        });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        status: 'VALID',
        isValid: true,
        isAuthentic: true,
        detectedType: 'Earth Observation / Satellite Scene',
      });
    };

    img.src = url;
  });
};

/**
 * End-to-end Satellite Authenticity Validation via Backend API.
 * Adheres strictly to defensive parsing guidelines:
 * - Checks response.ok, HTTP status, and Content-Type header
 * - Safely reads raw text to guard against HTML pages or empty bodies
 * - Catches JSON parse errors cleanly without throwing unhandled syntax exceptions
 * - Returns structured status: 'VALID' | 'INVALID' | 'UNAVAILABLE'
 */
export async function validateSatelliteAuthenticityAPI(
  file: File,
  base64Data?: string
): Promise<ClientValidationResult> {
  // Step 1: Run quick local client heuristic
  const localCheck = await validateClientImage(file);
  if (!localCheck.isValid) {
    return localCheck;
  }

  // Step 2: Query backend authenticity verification endpoint
  try {
    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '';
    const endpoint = `${API_BASE_URL}/api/satellite/authenticity`;

    let dataUrl = base64Data;
    if (!dataUrl) {
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileData: dataUrl,
          mimetype: file.type || 'image/jpeg',
        }),
      });
    } catch (networkErr: any) {
      console.warn('[SatelliteAuthenticity] Network connection error:', networkErr);
      return {
        status: 'UNAVAILABLE',
        isValid: true,
        isAuthentic: false,
        detectedType: 'Earth Observation (Verification Offline)',
        errorMessage: 'Satellite authenticity check unavailable: network connection error.',
      };
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text().catch(() => '');
    const trimmed = (text || '').trim();
    const isHtml = trimmed.startsWith('<') || trimmed.toLowerCase().includes('<!doctype') || trimmed.toLowerCase().includes('<html');

    // Check if server returned non-2xx HTTP status or HTML document
    if (!response.ok || isHtml || !contentType.includes('application/json')) {
      console.warn(`[SatelliteAuthenticity] Non-JSON or error response (status=${response.status}, isHtml=${isHtml}, contentType=${contentType})`);
      return {
        status: 'UNAVAILABLE',
        isValid: true,
        isAuthentic: false,
        detectedType: 'Satellite Scene',
        reason: 'Satellite verification service temporarily unavailable.',
        errorMessage: 'Satellite authenticity check unavailable.',
      };
    }

    // Safely parse JSON
    let data: any = null;
    try {
      data = JSON.parse(trimmed);
    } catch (jsonErr) {
      console.warn('[SatelliteAuthenticity] JSON parse error on response:', jsonErr);
      return {
        status: 'UNAVAILABLE',
        isValid: true,
        isAuthentic: false,
        detectedType: 'Satellite Scene',
        reason: 'Satellite verification service temporarily unavailable.',
        errorMessage: 'Satellite validation service returned an invalid response.',
      };
    }

    if (!data || typeof data !== 'object') {
      return {
        status: 'UNAVAILABLE',
        isValid: true,
        isAuthentic: false,
        detectedType: 'Satellite Scene',
        reason: 'Satellite verification service temporarily unavailable.',
        errorMessage: 'Satellite validation service returned an invalid response.',
      };
    }

    // Evaluate authenticity response
    if (data.authentic === true || data.data?.authentic === true || data.data?.isValidSatellite === true) {
      return {
        status: 'VALID',
        isValid: true,
        isAuthentic: true,
        detectedType: data.detectedType || data.data?.detectedType || 'Satellite Optical Scene',
        confidence: data.confidence || data.data?.confidence || 0.95,
        reason: data.reason || data.data?.reason || 'Satellite data validated successfully',
      };
    } else {
      const detectedType = data.detectedType || data.data?.detectedType || 'Non-Satellite Subject';
      const cleanReason = (typeof data.reason === 'string' && !data.reason.includes('<') && !data.reason.includes('Unexpected token'))
        ? data.reason
        : `Uploaded image does not appear to be an Earth observation or satellite scene (${detectedType}).`;

      return {
        status: 'INVALID',
        isValid: false,
        isAuthentic: false,
        detectedType,
        confidence: data.confidence || 0.95,
        reason: cleanReason,
        suggestedAction: data.suggestedAction || 'Please submit a valid satellite, aerial, or drone Earth observation scene.',
        errorMessage: cleanReason,
      };
    }
  } catch (err: any) {
    console.warn('[SatelliteAuthenticity] Unexpected validation error:', err);
    return {
      status: 'UNAVAILABLE',
      isValid: true,
      isAuthentic: false,
      detectedType: 'Satellite Scene',
      errorMessage: 'Satellite authenticity check unavailable.',
    };
  }
}
