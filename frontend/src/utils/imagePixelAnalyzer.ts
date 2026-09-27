import { SpectralStatistics, ObjectDetectionItem } from '../types/index.js';

export interface ImagePixelAnalysis {
  vegetationPercentage: number;
  waterPercentage: number;
  builtUpPercentage: number;
  bareSoilPercentage: number;
  meanIndex: number;
  minVal: number;
  maxVal: number;
  histogram: Array<{ range: string; percentage: number }>;
}

export interface FeatureExtractionDebugInfo {
  imageDimensions: { width: number; height: number; gridWidth: number; gridHeight: number };
  gsdMeters: number | null;
  aoiBoundingBox: { west: number; south: number; east: number; north: number };
  totalGridPixels: number;
  validPixels: number;
  waterPixels: number;
  vegetationPixels: number;
  builtUpPixels: number;
  bareSoilPixels: number;
  nodataOrCloudPixels: number;
  connectedComponentsIdentified: number;
  finalVectorPolygonsCount: number;
  polygonFeatures: Array<{ id: string; label: string; category: string; areaHa: number; areaSqM: number }>;
  crs: string;
}

/**
 * Calculates geodesic surface area in square meters on WGS84 ellipsoid using spherical excess formula.
 */
export function calculateGeodesicPolygonAreaSqM(coords: [number, number][]): number {
  if (!coords || coords.length < 3) return 0;
  const radius = 6378137.0; // WGS84 Earth equatorial radius in meters
  let total = 0.0;
  const len = coords.length;

  for (let i = 0; i < len; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % len];
    const lon1 = (p1[0] * Math.PI) / 180.0;
    const lat1 = (p1[1] * Math.PI) / 180.0;
    const lon2 = (p2[0] * Math.PI) / 180.0;
    const lat2 = (p2[1] * Math.PI) / 180.0;
    total += (lon2 - lon1) * (2.0 + Math.sin(lat1) + Math.sin(lat2));
  }

  const area = Math.abs((total * radius * radius) / 2.0);
  return Math.round(area);
}

/**
 * Ramer-Douglas-Peucker polygon simplification algorithm
 */
export function simplifyContour(points: [number, number][], epsilon: number): [number, number][] {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  const [x1, y1] = points[0];
  const [x2, y2] = points[points.length - 1];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    let dist = 0;
    if (lenSq === 0) {
      dist = Math.hypot(px - x1, py - y1);
    } else {
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      dist = Math.hypot(px - projX, py - projY);
    }
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyContour(points.slice(0, index + 1), epsilon);
    const right = simplifyContour(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [points[0], points[points.length - 1]];
  }
}

/**
 * Point in polygon test using ray casting
 */
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Estimates land-cover statistics from visible RGB pixels rendered by the browser.
 * This path cannot calculate multispectral indices from an RGB preview.
 */
export async function extractRealPixelSpectralStats(
  imageUrl: string,
  maskType: 'none' | 'NDVI' | 'NDWI' | 'NDBI' = 'NDVI',
): Promise<SpectralStatistics | null> {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let w = img.naturalWidth || img.width || 300;
        let h = img.naturalHeight || img.height || 300;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const totalPixels = w * h;

        let validPixels = 0;
        let waterCount = 0;
        let vegCount = 0;
        let builtUpCount = 0;
        let bareSoilCount = 0;

        let sumIndex = 0;
        let minIndex = 1.0;
        let maxIndex = -1.0;

        const binCounts = [0, 0, 0, 0];

        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];

          // Filter nodata borders & extreme clouds
          if (a < 30 || (r < 6 && g < 6 && b < 6)) {
            continue;
          }

          validPixels++;
          const rf = r / 255.0;
          const gf = g / 255.0;
          const bf = b / 255.0;
          const sumRGB = rf + gf + bf + 1e-5;
          const gcc = gf / sumRGB;
          const exg = 2 * gf - rf - bf;
          const wScore = (gf + bf - 2 * rf) / (gf + bf + 2 * rf + 1e-4);
          const maxC = Math.max(rf, gf, bf);
          const minC = Math.min(rf, gf, bf);
          const saturation = maxC > 0 ? (maxC - minC) / maxC : 0;
          const brightness = sumRGB / 3.0;

          let pixelIndex = 0;
          if (maskType === 'NDWI') {
            pixelIndex = (gf - (rf * 0.7 + bf * 0.3)) / (gf + (rf * 0.7 + bf * 0.3) + 1e-4);
          } else if (maskType === 'NDBI') {
            pixelIndex = (rf - gf) / (rf + gf + 1e-4);
          } else {
            // Visible-greenness proxy; RGB data has no near-infrared channel.
            pixelIndex = (gf * 1.3 - rf) / (gf * 1.3 + rf + 1e-4);
          }

          sumIndex += pixelIndex;
          if (pixelIndex < minIndex) minIndex = pixelIndex;
          if (pixelIndex > maxIndex) maxIndex = pixelIndex;

          if (pixelIndex < -0.2) binCounts[0]++;
          else if (pixelIndex < 0.1) binCounts[1]++;
          else if (pixelIndex < 0.4) binCounts[2]++;
          else binCounts[3]++;

          // Physical land cover classification
          // Reject neutral/achromatic shadows: in dark shadows, |r - g| < 0.02 and |g - b| < 0.02
          const isNeutralShadow = Math.abs(rf - gf) < 0.022 && Math.abs(gf - bf) < 0.022;
          const isWater =
            !isNeutralShadow &&
            rf < 0.22 &&
            brightness < 0.45 &&
            rf < gf * 0.92 &&
            rf < bf * 0.90 &&
            (wScore > 0.08 || (bf > rf * 1.15 && bf >= gf * 0.80));

          const isVeg =
            !isWater &&
            gf > rf * 1.10 &&
            gf > bf * 1.05 &&
            exg > 0.03 &&
            gcc > 0.36;

          const isBuiltUp =
            !isWater &&
            !isVeg &&
            brightness > 0.58 &&
            saturation < 0.08 &&
            Math.abs(rf - gf) < 0.03;

          if (isWater) {
            waterCount++;
          } else if (isVeg) {
            vegCount++;
          } else if (isBuiltUp) {
            builtUpCount++;
          } else {
            bareSoilCount++;
          }
        }

        if (validPixels === 0) {
          resolve(null);
          return;
        }

        const waterPct = Number(((waterCount / validPixels) * 100).toFixed(1));
        const vegPct = Number(((vegCount / validPixels) * 100).toFixed(1));
        const builtUpPct = Number(((builtUpCount / validPixels) * 100).toFixed(1));
        const bareSoilPct = Number(Math.max(0, 100.0 - (waterPct + vegPct + builtUpPct)).toFixed(1));

        const meanIdx = Number((sumIndex / validPixels).toFixed(3));

        const histRanges =
          maskType === 'NDWI'
            ? [
                { range: '< -0.2 (low RGB proxy score)', percentage: Number(((binCounts[0] / validPixels) * 100).toFixed(1)) },
                { range: '-0.2 to 0.1 (low-to-neutral RGB proxy)', percentage: Number(((binCounts[1] / validPixels) * 100).toFixed(1)) },
                { range: '0.1 to 0.4 (moderate RGB proxy)', percentage: Number(((binCounts[2] / validPixels) * 100).toFixed(1)) },
                { range: '> 0.4 (high RGB proxy score)', percentage: Number(((binCounts[3] / validPixels) * 100).toFixed(1)) },
              ]
            : maskType === 'NDBI'
            ? [
                { range: '< -0.2 (low RGB proxy score)', percentage: Number(((binCounts[0] / validPixels) * 100).toFixed(1)) },
                { range: '-0.2 to 0.1 (low-to-neutral RGB proxy)', percentage: Number(((binCounts[1] / validPixels) * 100).toFixed(1)) },
                { range: '0.1 to 0.4 (moderate RGB proxy)', percentage: Number(((binCounts[2] / validPixels) * 100).toFixed(1)) },
                { range: '> 0.4 (high RGB proxy score)', percentage: Number(((binCounts[3] / validPixels) * 100).toFixed(1)) },
              ]
            : [
                { range: '< -0.2 (low visible-greenness proxy)', percentage: Number(((binCounts[0] / validPixels) * 100).toFixed(1)) },
                { range: '-0.2 to 0.1 (low visible-greenness proxy)', percentage: Number(((binCounts[1] / validPixels) * 100).toFixed(1)) },
                { range: '0.1 to 0.4 (moderate visible-greenness proxy)', percentage: Number(((binCounts[2] / validPixels) * 100).toFixed(1)) },
                { range: '> 0.4 (high visible-greenness proxy)', percentage: Number(((binCounts[3] / validPixels) * 100).toFixed(1)) },
              ];

        resolve({
          vegetationPercentage: vegPct,
          waterPercentage: waterPct,
          builtUpPercentage: builtUpPct,
          bareSoilPercentage: bareSoilPct,
          meanIndex: meanIdx,
          minVal: Number(minIndex.toFixed(2)),
          maxVal: Number(maxIndex.toFixed(2)),
          histogram: histRanges,
          validPixelCount: validPixels,
          totalPixels,
          excludedPixelCount: totalPixels - validPixels,
          isMultispectral: false,
          method: 'RGB color heuristic estimates; spectral indices and ground area are unavailable from this preview.',
        });
      } catch (err) {
        console.warn('extractRealPixelSpectralStats failed:', err);
        resolve(null);
      }
    };

    img.onerror = () => {
      resolve(null);
    };
  });
}

/**
 * Extracts genuine visible geographic features (water bodies, vegetation regions, built-up clusters)
 * directly from satellite raster imagery and computes georeferenced polygon boundaries, geodesic areas, and detections.
 */
export async function extractRealImageFeatures(
  imageUrl: string,
  bbox: { west: number; south: number; east: number; north: number },
  aoi?: any,
  filterCategory?: 'all' | 'water_body' | 'vegetation' | 'building' | 'infrastructure',
  imageMetadata?: { resolution_meters?: number; bands?: string[]; satellite?: string }
): Promise<{ detections: ObjectDetectionItem[]; geojsonLayers: any; debugInfo?: FeatureExtractionDebugInfo }> {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve({ detections: [], geojsonLayers: { type: 'FeatureCollection', features: [] } });
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const gridW = 256;
        const gridH = 256;
        canvas.width = gridW;
        canvas.height = gridH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ detections: [], geojsonLayers: { type: 'FeatureCollection', features: [] } });
          return;
        }

        ctx.drawImage(img, 0, 0, gridW, gridH);
        const imgData = ctx.getImageData(0, 0, gridW, gridH);
        const data = imgData.data;

        // Classification Matrix: 0=NoData/BareSoil, 1=Water, 2=Vegetation, 3=Built-up
        const rawMatrix = new Int8Array(gridW * gridH);
        let validPixels = 0;

        // Parse AOI polygon coordinates for clipping if present
        let aoiPoly: [number, number][] | null = null;
        if (aoi?.coordinates && aoi.coordinates[0]?.length > 2) {
          aoiPoly = aoi.coordinates[0].map((c: any) => [c[0], c[1]]);
        }

        const deltaLat = bbox.north - bbox.south;
        const deltaLng = bbox.east - bbox.west;

        for (let y = 0; y < gridH; y++) {
          for (let x = 0; x < gridW; x++) {
            const pos = y * gridW + x;
            const idx = pos * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            // Filter nodata borders & transparent bounds
            if (a < 30 || (r < 6 && g < 6 && b < 6)) {
              rawMatrix[pos] = 0;
              continue;
            }

            // AOI Clipping at pixel level
            if (aoiPoly) {
              const pixelLng = bbox.west + (x / gridW) * deltaLng;
              const pixelLat = bbox.north - (y / gridH) * deltaLat;
              if (!isPointInPolygon([pixelLng, pixelLat], aoiPoly)) {
                rawMatrix[pos] = 0;
                continue;
              }
            }

            validPixels++;
            const rf = r / 255.0;
            const gf = g / 255.0;
            const bf = b / 255.0;
            const sumRGB = rf + gf + bf + 1e-5;
            const gcc = gf / sumRGB;
            const exg = 2 * gf - rf - bf;
            const wScore = (gf + bf - 2 * rf) / (gf + bf + 2 * rf + 1e-4);
            const maxC = Math.max(rf, gf, bf);
            const minC = Math.min(rf, gf, bf);
            const saturation = maxC > 0 ? (maxC - minC) / maxC : 0;
            const brightness = sumRGB / 3.0;

            // Strict physical classifications
            // Reject neutral mountain shadows: in shadows, |r - g| < 0.02 and |g - b| < 0.02
            const isNeutralShadow = Math.abs(rf - gf) < 0.022 && Math.abs(gf - bf) < 0.022;
            const isWater =
              !isNeutralShadow &&
              rf < 0.22 &&
              brightness < 0.45 &&
              rf < gf * 0.92 &&
              rf < bf * 0.90 &&
              (wScore > 0.08 || (bf > rf * 1.15 && bf >= gf * 0.80));

            const isVeg =
              !isWater &&
              gf > rf * 1.10 &&
              gf > bf * 1.05 &&
              exg > 0.03 &&
              gcc > 0.36;

            const isBuiltUp =
              !isWater &&
              !isVeg &&
              brightness > 0.58 &&
              saturation < 0.08 &&
              Math.abs(rf - gf) < 0.03;

            if (isWater) {
              rawMatrix[pos] = 1; // Water
            } else if (isVeg) {
              rawMatrix[pos] = 2; // Vegetation
            } else if (isBuiltUp) {
              rawMatrix[pos] = 3; // Built-up
            } else {
              rawMatrix[pos] = 0; // Bare soil / background
            }
          }
        }

        if (validPixels === 0) {
          resolve({ detections: [], geojsonLayers: { type: 'FeatureCollection', features: [] } });
          return;
        }

        // Morphological noise filtering on water pixels: remove isolated 1-pixel noise & thin neck bridges
        const matrix = new Int8Array(gridW * gridH);
        matrix.set(rawMatrix);
        let waterPixelCount = 0;
        let vegPixelCount = 0;
        let builtUpPixelCount = 0;
        let bareSoilPixelCount = 0;

        for (let y = 1; y < gridH - 1; y++) {
          for (let x = 1; x < gridW - 1; x++) {
            const pos = y * gridW + x;
            if (rawMatrix[pos] === 1) {
              let wNeigh = 0;
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (dx === 0 && dy === 0) continue;
                  if (rawMatrix[(y + dy) * gridW + (x + dx)] === 1) {
                    wNeigh++;
                  }
                }
              }
              if (wNeigh < 2) {
                matrix[pos] = 0; // eliminate isolated noise
              }
            }
          }
        }

        // Count cleaned pixels
        for (let i = 0; i < gridW * gridH; i++) {
          const c = matrix[i];
          if (c === 1) waterPixelCount++;
          else if (c === 2) vegPixelCount++;
          else if (c === 3) builtUpPixelCount++;
          else if (c === 0 && rawMatrix[i] !== -1) bareSoilPixelCount++;
        }

        // Connected Components Labeling (8-connectivity BFS)
        const visited = new Int8Array(gridW * gridH);
        const components: Array<{
          classId: number;
          pixels: Array<[number, number]>;
          minX: number;
          maxX: number;
          minY: number;
          maxY: number;
        }> = [];

        for (let y = 0; y < gridH; y++) {
          for (let x = 0; x < gridW; x++) {
            const pos = y * gridW + x;
            const cId = matrix[pos];
            if (cId === 0 || visited[pos] !== 0) continue;

            const queue: Array<[number, number]> = [[x, y]];
            visited[pos] = 1;
            const compPixels: Array<[number, number]> = [];
            let minX = x;
            let maxX = x;
            let minY = y;
            let maxY = y;

            while (queue.length > 0) {
              const [currX, currY] = queue.pop()!;
              compPixels.push([currX, currY]);

              if (currX < minX) minX = currX;
              if (currX > maxX) maxX = currX;
              if (currY < minY) minY = currY;
              if (currY > maxY) maxY = currY;

              const neighbors = [
                [currX + 1, currY],
                [currX - 1, currY],
                [currX, currY + 1],
                [currX, currY - 1],
                [currX + 1, currY + 1],
                [currX - 1, currY - 1],
                [currX + 1, currY - 1],
                [currX - 1, currY + 1],
              ];

              for (const [nx, ny] of neighbors) {
                if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
                  const npos = ny * gridW + nx;
                  if (visited[npos] === 0 && matrix[npos] === cId) {
                    visited[npos] = 1;
                    queue.push([nx, ny]);
                  }
                }
              }
            }

            // Filter out micro-noise speckles: must be >= 25 pixels or >= 0.2% of valid pixels
            const minSize = Math.max(25, Math.round(validPixels * 0.002));
            if (compPixels.length >= minSize) {
              components.push({
                classId: cId,
                pixels: compPixels,
                minX,
                maxX,
                minY,
                maxY,
              });
            }
          }
        }

        // Sort genuine components by pixel area (largest first)
        components.sort((a, b) => b.pixels.length - a.pixels.length);

        const detections: ObjectDetectionItem[] = [];
        const features: any[] = [];

        components.forEach((comp, idx) => {
          const cat =
            comp.classId === 1
              ? 'water_body'
              : comp.classId === 2
              ? 'vegetation'
              : 'building';

          if (filterCategory && filterCategory !== 'all' && cat !== filterCategory) {
            return;
          }

          const ymin = Number((comp.minY / gridH).toFixed(4));
          const xmin = Number((comp.minX / gridW).toFixed(4));
          const ymax = Number(((comp.maxY + 1) / gridH).toFixed(4));
          const xmax = Number(((comp.maxX + 1) / gridW).toFixed(4));

          // Set of pixels in component for boundary tracing
          const pixelSet = new Set<string>();
          for (const [px, py] of comp.pixels) {
            pixelSet.add(`${px},${py}`);
          }

          // Topmost-leftmost boundary pixel
          let startPx = comp.minX;
          let startPy = comp.minY;
          for (let y = comp.minY; y <= comp.maxY; y++) {
            let found = false;
            for (let x = comp.minX; x <= comp.maxX; x++) {
              if (pixelSet.has(`${x},${y}`)) {
                startPx = x;
                startPy = y;
                found = true;
                break;
              }
            }
            if (found) break;
          }

          // Clockwise boundary tracing (Jacob's stopping criterion)
          // Directions: 0=E, 1=SE, 2=S, 3=SW, 4=W, 5=NW, 6=N, 7=NE
          const DIRS: [number, number][] = [
            [1, 0],
            [1, 1],
            [0, 1],
            [-1, 1],
            [-1, 0],
            [-1, -1],
            [0, -1],
            [1, -1],
          ];

          const boundaryPoints: [number, number][] = [];
          let currX = startPx;
          let currY = startPy;
          let checkDir = 7;
          boundaryPoints.push([currX, currY]);

          const maxSteps = Math.max(120, comp.pixels.length * 4);
          let step = 0;

          while (step < maxSteps) {
            step++;
            let nextFound = false;

            for (let i = 0; i < 8; i++) {
              const d = (checkDir + i) % 8;
              const nx = currX + DIRS[d][0];
              const ny = currY + DIRS[d][1];

              if (pixelSet.has(`${nx},${ny}`)) {
                currX = nx;
                currY = ny;
                boundaryPoints.push([currX, currY]);
                checkDir = (d + 5) % 8;
                nextFound = true;
                break;
              }
            }

            if (!nextFound) break;
            if (currX === startPx && currY === startPy && boundaryPoints.length > 3) {
              break;
            }
          }

          // Simplify boundary using RDP (epsilon = 1.0 grid pixels)
          let simplifiedGrid = simplifyContour(boundaryPoints, 1.0);
          if (simplifiedGrid.length < 3) {
            simplifiedGrid = boundaryPoints.slice(0, Math.min(boundaryPoints.length, 30));
          }

          // Convert grid coordinates to geographic [lng, lat]
          const geoPolygon: [number, number][] = simplifiedGrid.map(([gx, gy]) => {
            const lng = bbox.west + (gx / gridW) * deltaLng;
            const lat = bbox.north - (gy / gridH) * deltaLat;
            return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
          });

          // Ensure polygon ring is closed
          if (
            geoPolygon.length >= 3 &&
            (geoPolygon[0][0] !== geoPolygon[geoPolygon.length - 1][0] ||
              geoPolygon[0][1] !== geoPolygon[geoPolygon.length - 1][1])
          ) {
            geoPolygon.push([geoPolygon[0][0], geoPolygon[0][1]]);
          }

          if (geoPolygon.length < 4) {
            return;
          }

          // Geodesic surface area calculation
          const areaSqM = calculateGeodesicPolygonAreaSqM(geoPolygon);
          const areaHa = Number((areaSqM / 10000.0).toFixed(2));

          const featureId = `feat-${cat}-${idx + 1}`;
          const baseName =
            comp.classId === 1
              ? 'Water Surface'
              : comp.classId === 2
              ? 'Vegetated Canopy'
              : 'Structural Cluster';

          const label = `${baseName} (~${areaHa} ha)`;

          const spectralBasis =
            comp.classId === 1
              ? 'RGB water-color contrast estimate'
              : comp.classId === 2
              ? 'RGB visible-greenness estimate'
              : 'RGB impervious-color contrast estimate';

          const detectionItem: ObjectDetectionItem = {
            id: featureId,
            label,
            category: cat,
            box_2d: [ymin, xmin, ymax, xmax],
            area_sq_m: areaSqM,
            area_ha: areaHa,
            polygon: geoPolygon,
            spectralIndex: spectralBasis,
          };

          detections.push(detectionItem);

          features.push({
            type: 'Feature',
            id: featureId,
            geometry: {
              type: 'Polygon',
              coordinates: [geoPolygon],
            },
            properties: {
              id: featureId,
              label,
              category: cat,
              area_ha: areaHa,
              area_sq_m: areaSqM,
              spectralIndex: spectralBasis,
            },
          });
        });

        const debugInfo: FeatureExtractionDebugInfo = {
          imageDimensions: {
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            gridWidth: gridW,
            gridHeight: gridH,
          },
          gsdMeters: imageMetadata?.resolution_meters || null,
          aoiBoundingBox: bbox,
          totalGridPixels: gridW * gridH,
          validPixels,
          waterPixels: waterPixelCount,
          vegetationPixels: vegPixelCount,
          builtUpPixels: builtUpPixelCount,
          bareSoilPixels: bareSoilPixelCount,
          nodataOrCloudPixels: (gridW * gridH) - validPixels,
          connectedComponentsIdentified: components.length,
          finalVectorPolygonsCount: features.length,
          polygonFeatures: features.map((f) => ({
            id: f.id,
            label: f.properties.label,
            category: f.properties.category,
            areaHa: f.properties.area_ha,
            areaSqM: f.properties.area_sq_m,
          })),
          crs: 'EPSG:4326 (WGS84)',
        };

        resolve({
          detections,
          geojsonLayers: {
            type: 'FeatureCollection',
            features,
          },
          debugInfo,
        });
      } catch (err) {
        console.warn('[imagePixelAnalyzer] extractRealImageFeatures failed:', err);
        resolve({ detections: [], geojsonLayers: { type: 'FeatureCollection', features: [] } });
      }
    };

    img.onerror = () => {
      resolve({ detections: [], geojsonLayers: { type: 'FeatureCollection', features: [] } });
    };
  });
}
