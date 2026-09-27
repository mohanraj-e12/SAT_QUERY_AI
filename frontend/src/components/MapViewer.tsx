import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, Eye, EyeOff, Compass, Crosshair, MapPin, Info, X, Activity, FileImage } from 'lucide-react';
import { ObjectDetectionItem, SatelliteImage, AnalysisType } from '../types/index.js';
import { extractRealImageFeatures, FeatureExtractionDebugInfo } from '../utils/imagePixelAnalyzer.js';

interface MapViewerProps {
  image?: SatelliteImage | null;
  selectedImage?: SatelliteImage | null;
  aoi?: any | null;
  detections?: ObjectDetectionItem[];
  geojsonLayers?: any;
  analysisOverlays?: Record<string, string>;
  geographicBounds?: { west: number; south: number; east: number; north: number } | null;
  analysisPerformed?: boolean;
  analysisType?: AnalysisType;
  spectralMaskType?: 'none' | 'NDVI' | 'NDWI' | 'NDBI' | 'False Color';
  className?: string;
  height?: string;
  onCoordinatesChange?: (lat: number, lng: number) => void;
  onSpectralMaskChange?: (mask: 'none' | 'NDVI' | 'NDWI' | 'NDBI' | 'False Color') => void;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  image: imageProp,
  selectedImage,
  aoi,
  detections: detectionsProp = [],
  geojsonLayers: geojsonLayersProp,
  analysisOverlays,
  geographicBounds,
  analysisPerformed = false,
  analysisType,
  spectralMaskType = 'none',
  className = '',
  height = '500px',
  onCoordinatesChange,
  onSpectralMaskChange,
}) => {
  const image = imageProp || selectedImage || null;
  const candidateBounds = geographicBounds || image?.bbox;
  const imageBounds = candidateBounds
    && candidateBounds !== null
    && Number.isFinite(candidateBounds.west)
    && Number.isFinite(candidateBounds.south)
    && Number.isFinite(candidateBounds.east)
    && Number.isFinite(candidateBounds.north)
    && candidateBounds.west < candidateBounds.east
    && candidateBounds.south < candidateBounds.north
    && candidateBounds.west >= -180
    && candidateBounds.east <= 180
    && candidateBounds.south >= -90
    && candidateBounds.north <= 90
    ? candidateBounds
    : null;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [activeBaseLayer, setActiveBaseLayer] = useState<'satellite' | 'dark'>('satellite');
  const [showDetections, setShowDetections] = useState<boolean>(true);
  const [showVectors, setShowVectors] = useState<boolean>(true);
  const [showAOI, setShowAOI] = useState<boolean>(true);
  const [showImageOverlay, setShowImageOverlay] = useState<boolean>(true);
  const [currentMask, setCurrentMask] = useState<'none' | 'NDVI' | 'NDWI' | 'NDBI' | 'False Color'>(spectralMaskType);
  const [autoDetections, setAutoDetections] = useState<ObjectDetectionItem[]>([]);
  const [autoGeojson, setAutoGeojson] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<FeatureExtractionDebugInfo | null>(null);
  const [showDebugModal, setShowDebugModal] = useState<boolean>(false);

  // Image-relative preview for uploaded scenes that carry no georeferencing
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const [previewNatural, setPreviewNatural] = useState<{ w: number; h: number } | null>(null);
  const [previewArea, setPreviewArea] = useState<{ w: number; h: number } | null>(null);
  const [previewFailed, setPreviewFailed] = useState<boolean>(false);

  useEffect(() => {
    setPreviewFailed(false);
    setPreviewNatural(null);
  }, [image?.file_url]);

  useEffect(() => {
    const measure = () => {
      const el = previewWrapRef.current;
      if (el) setPreviewArea({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [image?.file_url, imageBounds]);

  // Fit the scene inside the stage while preserving its aspect ratio (mimics object-contain math)
  const previewFit = (() => {
    if (!previewNatural || !previewArea) return null;
    const ar = previewNatural.w / previewNatural.h || 1;
    const w = Math.min(previewArea.w, previewArea.h * ar);
    const h = w / ar;
    return { w, h, x: (previewArea.w - w) / 2, y: (previewArea.h - h) / 2 };
  })();

  const [activeCoords, setActiveCoords] = useState<{ lat: number; lng: number; zoom: number }>({
    lat: 0,
    lng: 0,
    zoom: 2,
  });
  const overlays = analysisOverlays || {};
  const activeAnalysisOverlay = currentMask === 'NDVI'
    ? overlays.ndvi
    : currentMask === 'NDWI'
      ? overlays.mndwi || overlays.ndwi
      : currentMask === 'NDBI'
        ? overlays.ndbi
        : undefined;

  useEffect(() => {
    setCurrentMask(spectralMaskType);
  }, [spectralMaskType]);

  // Extract real geographic features and boundary polygon contours from raster data.
  // Plain RGB uploads have no bbox, so still extract image-relative features/vectors
  // with a unit-square fallback (0..1 lon/lat) so detections, polygons, and telemetry work.
  const hasGeoreferencing = Boolean(imageBounds);
  useEffect(() => {
    let isMounted = true;
    if (!image?.file_url || analysisPerformed) {
      setAutoDetections([]);
      setAutoGeojson(null);
      setDebugInfo(null);
      return;
    }

    const hasPropDetections = detectionsProp && detectionsProp.length > 0;
    const hasPropVectors = geojsonLayersProp?.features && geojsonLayersProp.features.length > 0;

    const fallbackBounds = { west: 0, south: 0, east: 1, north: 1 };
    extractRealImageFeatures(
      image.file_url,
      imageBounds || fallbackBounds,
      aoi,
      analysisType === 'WATER_DETECTION'
        ? 'water_body'
        : analysisType === 'VEGETATION'
        ? 'vegetation'
        : analysisType === 'BUILT_UP_ANALYSIS'
        ? 'building'
        : 'all',
      {
        resolution_meters: image.resolution_meters,
        bands: image.bands,
        satellite: image.satellite,
      }
    )
      .then((result) => {
        if (isMounted) {
          if (result.debugInfo) {
            setDebugInfo(result.debugInfo);
          }
          if (!hasPropDetections) {
            setAutoDetections(result.detections);
          }
          if (!hasPropVectors) {
            setAutoGeojson(result.geojsonLayers);
          }
        }
      })
      .catch((err) => {
        console.warn('[MapViewer] Real feature extraction warning:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [image?.file_url, image?.id, hasGeoreferencing, analysisPerformed, aoi, analysisType, detectionsProp, geojsonLayersProp]);

  // Active detections & vectors
  const activeDetections =
    detectionsProp && detectionsProp.length > 0 ? detectionsProp : autoDetections;
  const activeGeojsonLayers =
    geojsonLayersProp?.features && geojsonLayersProp.features.length > 0
      ? geojsonLayersProp
      : autoGeojson;

  // Base tile layers
  const satelliteTileUrl =
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const darkTileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

  // 1. Initialize Map
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
      return;
    }
    if ((container as any)._leaflet_id) {
      try {
        (container as any)._leaflet_id = null;
      } catch { /* ignore */ }
    }

    const map = L.map(container, {
        center: [0, 0],
        zoom: 2,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      const baseLayer = L.tileLayer(
        activeBaseLayer === 'satellite' ? satelliteTileUrl : darkTileUrl,
        {
          maxNativeZoom: activeBaseLayer === 'satellite' ? 18 : 19,
          maxZoom: 22,
        }
      ).addTo(map);

      (map as any)._baseTileLayer = baseLayer;

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;

      map.on('mousemove', (e: L.LeafletMouseEvent) => {
        const coords = {
          lat: Number(e.latlng.lat.toFixed(5)),
          lng: Number(e.latlng.lng.toFixed(5)),
          zoom: map.getZoom(),
        };
        setActiveCoords(coords);
        onCoordinatesChange?.(coords.lat, coords.lng);
      });

      mapInstanceRef.current = map;

    return () => {
      try {
        mapInstanceRef.current?.remove();
      } catch { /* ignore */ }
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
      if (container) {
        try {
          container.innerHTML = '';
          (container as any)._leaflet_id = null;
        } catch { /* ignore */ }
      }
    };
  }, []);

  // 2. Handle Base Layer Swap
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if ((map as any)._baseTileLayer) {
      map.removeLayer((map as any)._baseTileLayer);
    }
    const newBase = L.tileLayer(
      activeBaseLayer === 'satellite' ? satelliteTileUrl : darkTileUrl,
      {
        maxZoom: 19,
      }
    ).addTo(map);
    (map as any)._baseTileLayer = newBase;
  }, [activeBaseLayer]);

  // 3. Update Map Layers & Overlays (AOI, Footprint, GIS Vectors, Features)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const lg = layerGroupRef.current;
    if (!map || !lg) return;

    lg.clearLayers();

    // Pan/zoom to image location if image changes
    if (imageBounds) {
      const { west, south, east, north } = imageBounds;
      const bounds: L.LatLngBoundsExpression = [
        [south, west],
        [north, east],
      ];
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 12, animate: true });
      setActiveCoords({
        lat: (south + north) / 2,
        lng: (west + east) / 2,
        zoom: map.getZoom(),
      });

      // Satellite raster overlay (if enabled)
      if (showImageOverlay && image.file_url) {
        try {
          const overlay = L.imageOverlay(image.file_url, bounds, {
            opacity: currentMask !== 'none' ? 0.75 : 0.95,
          });
          lg.addLayer(overlay);
        } catch (e) {
          console.warn('[Map] Image overlay error:', e);
        }
      }

      // Footprint boundary polygon
      const footprint = L.rectangle(bounds, {
        color: '#06B6D4',
        weight: 1.5,
        dashArray: '4, 4',
        fill: false,
      });
      footprint.bindTooltip(
        `<div class="text-xs font-mono"><b>Image: ${image.satellite}</b><br/>Acquired: ${image.acquisition_date || 'Unavailable'}${image.resolution_meters != null ? `<br/>GSD: ${image.resolution_meters}m` : ''}</div>`,
        {
          className: 'leaflet-custom-tooltip',
        }
      );
      lg.addLayer(footprint);

      if (showDetections) {
        activeDetections.forEach((detection) => {
          const [ymin, xmin, ymax, xmax] = detection.box_2d;
          if (![ymin, xmin, ymax, xmax].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
            || ymin >= ymax || xmin >= xmax) return;
          const detectedBounds: L.LatLngBoundsExpression = [
            [north - ymax * (north - south), west + xmin * (east - west)],
            [north - ymin * (north - south), west + xmax * (east - west)],
          ];
          const color = detection.category === 'water_body'
            ? '#0284C7'
            : detection.category === 'vegetation'
              ? '#10B981'
              : '#EF4444';
          const region = L.rectangle(detectedBounds, {
            color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.16,
          });
          region.bindTooltip(`${detection.label} (approximate image-mask envelope)`);
          lg.addLayer(region);
        });
      }
    }

    // AOI Polygon
    if (showAOI && aoi?.coordinates) {
      try {
        const geoLayer = L.geoJSON(aoi, {
          style: {
            color: '#F59E0B',
            weight: 2,
            dashArray: '5, 5',
            fillColor: '#F59E0B',
            fillOpacity: 0.12,
          },
        });
        geoLayer.bindPopup('<b class="font-mono text-xs">Designated Area of Interest (AOI)</b>');
        lg.addLayer(geoLayer);
      } catch (err) {
        console.warn('[Map] AOI render error:', err);
      }
    }

    // GIS Vector GeoJSON Layers (Irregular polygons following real geographic feature boundaries)
    if (showVectors && activeGeojsonLayers?.features && activeGeojsonLayers.features.length > 0) {
      try {
        const vectorLayer = L.geoJSON(activeGeojsonLayers, {
          style: (feature: any) => {
            const cat = feature?.properties?.category || '';
            const label = (feature?.properties?.label || '').toLowerCase();
            let strokeColor = '#06B6D4';
            let fillColor = '#06B6D4';
            let fillOpacity = 0.32;

            if (cat === 'water_body' || label.includes('water') || label.includes('reservoir') || label.includes('lake')) {
              strokeColor = '#0284C7'; // deep oceanic blue
              fillColor = '#0284C7';
              fillOpacity = 0.40;
            } else if (cat === 'vegetation' || cat === 'agricultural_field' || label.includes('veg') || label.includes('canopy')) {
              strokeColor = '#10B981'; // emerald green
              fillColor = '#10B981';
              fillOpacity = 0.35;
            } else if (cat === 'building' || label.includes('built-up') || label.includes('structure')) {
              strokeColor = '#EF4444'; // rose red
              fillColor = '#EF4444';
              fillOpacity = 0.30;
            } else if (cat === 'infrastructure' || cat === 'road') {
              strokeColor = '#8B5CF6'; // violet
              fillColor = '#8B5CF6';
              fillOpacity = 0.32;
            }

            return {
              color: strokeColor,
              weight: 2,
              fillColor: fillColor,
              fillOpacity: fillOpacity,
            };
          },
          onEachFeature: (feature: any, layer: any) => {
            const props = feature.properties || {};
            const areaHa = props.area_ha ?? (props.area_sq_m ? (props.area_sq_m / 10000).toFixed(2) : 'N/A');
            const confStr = props.confidence && typeof props.confidence === 'number' ? `${(props.confidence * 100).toFixed(0)}%` : 'unavailable';
            const spec = props.spectralIndex || props.evidence || '';

            layer.bindPopup(
              `<div class="text-xs font-mono p-1 space-y-1">
                <div class="font-bold text-slate-900 border-b border-slate-200 pb-1">${props.label || 'Detected Geographic Feature'}</div>
                <div class="text-slate-700">Feature Type: <span class="font-semibold text-slate-900">${props.category || 'Surface Feature'}</span></div>
                <div class="text-slate-700">Confidence: <span class="font-semibold ${confStr !== 'unavailable' ? 'text-emerald-700' : 'text-slate-500'}">${confStr}</span></div>
                ${areaHa !== 'N/A' ? `<div class="text-slate-700">Demarcated Area: <span class="font-semibold text-[#FD1843]">~${areaHa} ha</span></div>` : ''}
                ${spec ? `<div class="text-slate-500 text-[10px]">Basis: ${spec}</div>` : ''}
              </div>`
            );
          },
        });
        lg.addLayer(vectorLayer);
      } catch (err) {
        console.warn('[Map] GeoJSON vector render error:', err);
      }
    }

    // Spectral Mask Simulation Overlay
    if (currentMask !== 'none' && imageBounds && activeAnalysisOverlay) {
      const imageOverlayBounds: L.LatLngBoundsExpression = [
        [imageBounds.south, imageBounds.west],
        [imageBounds.north, imageBounds.east],
      ];
      lg.addLayer(L.imageOverlay(activeAnalysisOverlay, imageOverlayBounds, { opacity: 0.72 }));
    }
  }, [
    image,
    aoi,
    activeDetections,
    activeGeojsonLayers,
    showDetections,
    showVectors,
    showAOI,
    showImageOverlay,
    showDetections,
    currentMask,
    activeAnalysisOverlay,
    imageBounds,
  ]);

  const resetView = () => {
    if (mapInstanceRef.current && imageBounds) {
      mapInstanceRef.current.fitBounds([
        [imageBounds.south, imageBounds.west],
        [imageBounds.north, imageBounds.east],
      ]);
    }
  };

  const vectorCount = activeGeojsonLayers?.features?.length || 0;
  const detectionCount = activeDetections.length;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-[#eeddd3] bg-white isolate ${className}`}
      style={{ height }}
    >
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Image-relative preview when the scene has no georeferencing (uploaded PNG/JPG/TIFF) */}
      {!imageBounds && image?.file_url && (
        <div
          ref={previewWrapRef}
          className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40"
        >
          {!previewFailed ? (
            <div className="relative" style={previewFit ? { width: previewFit.w, height: previewFit.h } : undefined}>
              <img
                src={image.file_url}
                alt={image.file_name || 'Uploaded scene'}
                className={`block max-w-full max-h-full object-contain rounded shadow-lg border border-white/30 ${previewFit ? '' : 'w-full h-full'}`}
                onLoad={(e) => setPreviewNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                onError={() => setPreviewFailed(true)}
              />
              {/* Analysis detections drawn in image-relative (normalized) coordinates */}
              {showDetections && previewFit && activeDetections.map((detection, idx) => {
                const [ymin, xmin, ymax, xmax] = detection.box_2d;
                if (![ymin, xmin, ymax, xmax].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
                  || ymin >= ymax || xmin >= xmax) return null;
                const color = detection.category === 'water_body'
                  ? '#0284C7'
                  : detection.category === 'vegetation'
                    ? '#10B981'
                    : '#EF4444';
                return (
                  <div
                    key={`preview-detection-${idx}`}
                    className="absolute border-2 rounded-sm"
                    style={{
                      left: `${xmin * 100}%`,
                      top: `${ymin * 100}%`,
                      width: `${(xmax - xmin) * 100}%`,
                      height: `${(ymax - ymin) * 100}%`,
                      borderColor: color,
                      backgroundColor: `${color}22`,
                    }}
                    title={detection.label}
                  />
                );
              })}
              {/* GIS vector polygons drawn in image-relative (normalized) coordinates */}
              {showVectors && previewFit && activeGeojsonLayers?.features?.map((feature: any, idx: number) => {
                const ring = feature?.geometry?.coordinates?.[0];
                if (!Array.isArray(ring) || ring.length < 3) return null;
                // Fallback unit-square coords are 0..1 lon/lat; map them to % of the preview.
                const pts = ring
                  .map(([lng, lat]: [number, number]) => ({ x: Number(lng), y: 1 - Number(lat) }))
                  .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= -0.05 && p.x <= 1.05 && p.y >= -0.05 && p.y <= 1.05);
                if (pts.length < 3) return null;
                const cat = feature?.properties?.category || '';
                const fill = cat === 'water_body' ? '#0284C7' : cat === 'vegetation' || cat === 'agricultural_field' ? '#10B981' : cat === 'building' ? '#EF4444' : '#8B5CF6';
                return (
                  <svg key={`preview-vector-${idx}`} className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polygon
                      points={pts.map((p) => `${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)}`).join(' ')}
                      fill={`${fill}33`}
                      stroke={fill}
                      strokeWidth={0.6}
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>{feature?.properties?.label || 'Vector polygon'}</title>
                    </polygon>
                  </svg>
                );
              })}
              <span className="absolute top-2 left-2 rounded bg-slate-900/80 border border-white/20 px-2 py-0.5 text-[10px] font-mono text-white whitespace-nowrap">
                Uploaded image preview{vectorCount > 0 ? ` · ${vectorCount} vector${vectorCount === 1 ? '' : 's'}` : ''}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-white/95 border border-[#eeddd3] px-6 py-8 text-center max-w-md">
              <FileImage className="w-6 h-6 text-slate-400" />
              <p className="text-xs font-mono font-semibold text-slate-800">{image.file_name}</p>
              <p className="text-[11px] text-slate-500">
                This file format cannot be previewed in the browser.
                {' '}Analysis still runs on the uploaded raster; use the results panel above or the AI Assistant.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Top Left Floating Toolbar */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 rounded-lg bg-white/95 p-1.5 backdrop-blur-md border border-[#eeddd3] shadow-md">
        <div className="flex items-center rounded-md bg-[#FFF9F4] p-0.5 text-xs font-medium border border-[#eeddd3]">
          <button
            type="button"
            onClick={() => setActiveBaseLayer('satellite')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeBaseLayer === 'satellite'
                ? 'bg-[#FD1843] text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => setActiveBaseLayer('dark')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeBaseLayer === 'satellite'
                ? 'bg-[#FD1843] text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => setActiveBaseLayer('dark')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeBaseLayer === 'dark'
                ? 'bg-[#FD1843] text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Vector Map
          </button>
        </div>

        <div className="h-4 w-px bg-[#eeddd3] mx-0.5" />

        <button
          type="button"
          onClick={() => setShowImageOverlay(!showImageOverlay)}
          className={`px-2 py-1 rounded text-xs font-mono flex items-center gap-1 border transition-colors ${
            showImageOverlay && image?.file_url
              ? 'bg-sky-50 text-sky-700 border-sky-300 font-semibold'
              : 'bg-[#FFF9F4] text-slate-600 border-[#eeddd3]'
          }`}
          title={image?.file_url ? 'Toggle Uploaded Scene Overlay' : 'No scene image to overlay yet'}
        >
          <FileImage className="w-3 h-3" />
          <span>Scene Overlay</span>
        </button>

        {/* Layer Toggles */}
        <button
          type="button"
          onClick={() => setShowDetections(!showDetections)}
          className={`px-2 py-1 rounded text-xs font-mono flex items-center gap-1 border transition-colors ${
            showDetections && detectionCount > 0
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold'
              : 'bg-[#FFF9F4] text-slate-600 border-[#eeddd3]'
          }`}
          title="Toggle Target Detections"
        >
          {showDetections ? <Eye className="w-3 h-3 text-emerald-600" /> : <EyeOff className="w-3 h-3 text-slate-400" />}
          <span>Detections ({detectionCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setShowVectors(!showVectors)}
          className={`px-2 py-1 rounded text-xs font-mono flex items-center gap-1 border transition-colors ${
            showVectors && vectorCount > 0
              ? 'bg-[#FD1843]/10 text-[#FD1843] border-[#FD1843]/30 font-semibold'
              : 'bg-[#FFF9F4] text-slate-600 border-[#eeddd3]'
          }`}
          title="Toggle GIS Vector Polygons"
        >
          <Layers className="w-3 h-3" />
          <span>Vectors ({vectorCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setShowAOI(!showAOI)}
          className={`px-2 py-1 rounded text-xs font-mono flex items-center gap-1 border transition-colors ${
            showAOI
              ? 'bg-amber-50 text-amber-700 border-amber-300 font-semibold'
              : 'bg-[#FFF9F4] text-slate-600 border-[#eeddd3]'
          }`}
          title="Toggle AOI Polygon"
        >
          <Compass className="w-3 h-3" />
          <span>AOI</span>
        </button>

        {/* Spectral Band / Mask Switcher */}
        <div className="flex items-center gap-1 pl-1 border-l border-[#eeddd3]">
          <span className="text-[10px] text-slate-500 font-mono hidden md:inline">Band:</span>
          <select
            value={currentMask}
            onChange={(e) => {
              const val = e.target.value as any;
              setCurrentMask(val);
              onSpectralMaskChange?.(val);
            }}
            className="bg-white text-slate-800 text-xs font-mono rounded px-1.5 py-0.5 border border-[#eeddd3] focus:outline-none focus:border-[#FD1843] cursor-pointer"
          >
            <option value="none">RGB (True Color)</option>
            <option value="NDVI">NDVI (Vegetation)</option>
            <option value="NDWI">NDWI (Water)</option>
            <option value="NDBI">NDBI (Built-up)</option>
            <option value="False Color">False Color IR</option>
          </select>
        </div>

        {debugInfo && (
          <button
            type="button"
            onClick={() => setShowDebugModal(true)}
            className="px-2 py-1 rounded text-xs font-mono flex items-center gap-1 bg-[#FD1843]/10 text-[#FD1843] hover:bg-[#FD1843]/20 border border-[#FD1843]/30 transition-colors ml-1 font-semibold"
            title="Inspect Pipeline Telemetry & Debug Info"
          >
            <Activity className="w-3 h-3" />
            <span>Debug Info</span>
          </button>
        )}

        <button
          type="button"
          onClick={resetView}
          className="p-1 rounded text-slate-600 hover:text-[#FD1843] hover:bg-[#FFF9F4] transition-colors ml-1"
          title="Recenter Map View"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {/* Spectral Mask Indicator if Active */}
      {currentMask !== 'none' && (
        <div className="absolute top-3 right-14 z-20 px-3 py-1 rounded-full bg-white/95 border border-[#FD1843]/40 text-[#FD1843] text-xs font-mono font-semibold backdrop-blur-md flex items-center gap-2 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-[#FD1843] animate-pulse" />
          <span>Spectral Mode: {currentMask}{activeAnalysisOverlay ? '' : ' (data unavailable)'}</span>
        </div>
      )}

      {/* Bottom HUD Bar */}
      <div className="absolute bottom-2 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/90 px-3 py-1.5 text-[11px] font-mono text-slate-600 backdrop-blur-md border border-[#eeddd3] shadow-xs">
        <div className="flex items-center gap-3">
          {imageBounds ? (
            <span className="flex items-center gap-1 text-slate-800">
              <MapPin className="w-3 h-3 text-[#FD1843]" />
              Lat: {activeCoords.lat.toFixed(4)}°, Lng: {activeCoords.lng.toFixed(4)}°
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-600">
              <MapPin className="w-3 h-3 text-[#FD1843]" />
              Image view (no map coordinates)
            </span>
          )}
          <span className="text-[#eeddd3] hidden sm:inline">|</span>
          <span className="hidden sm:inline">Zoom: {activeCoords.zoom}x</span>
          <span className="text-[#eeddd3] hidden sm:inline">|</span>
          <span className="text-slate-500 hidden md:inline">CRS: EPSG:4326 (WGS84)</span>
        </div>
        {image && (
          <div className="flex items-center gap-2 text-slate-800">
            <span className="text-xs font-semibold text-[#FD1843]">{image.satellite}</span>
            <span className="text-slate-500">
              [{image.resolution_meters != null ? `${image.resolution_meters}m GSD` : 'Uploaded image'}]
            </span>
          </div>
        )}
      </div>

      {/* Debug Info Telemetry Modal */}
      {showDebugModal && debugInfo && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl max-h-[90%] overflow-y-auto rounded-xl bg-white border border-[#eeddd3] shadow-2xl p-5 text-xs font-mono text-slate-800">
            <div className="flex items-center justify-between border-b border-[#eeddd3] pb-3 mb-4">
              <div className="flex items-center gap-2 font-bold text-[#FD1843] text-sm">
                <Activity className="w-4 h-4" />
                <span>Detection & Vector Telemetry Pipeline</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDebugModal(false)}
                className="text-slate-400 hover:text-[#FD1843] p-1 rounded hover:bg-[#FFF9F4]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Dimensions and Metadata */}
              <div className="grid grid-cols-2 gap-2 bg-[#FFF9F4] p-3 rounded-lg border border-[#eeddd3]">
                <div>
                  <span className="text-slate-500">Image Source:</span>
                  <div className="text-slate-900 font-semibold">{debugInfo.imageDimensions.width} × {debugInfo.imageDimensions.height} px</div>
                </div>
                <div>
                  <span className="text-slate-500">Analysis Grid:</span>
                  <div className="text-slate-900 font-semibold">{debugInfo.imageDimensions.gridWidth} × {debugInfo.imageDimensions.gridHeight} ({debugInfo.totalGridPixels} px)</div>
                </div>
                <div>
                  <span className="text-slate-500">GSD:</span>
                  <div className="text-slate-900 font-semibold">{debugInfo.gsdMeters ? `${debugInfo.gsdMeters} meters/px` : 'N/A'}</div>
                </div>
                <div>
                  <span className="text-slate-500">CRS:</span>
                  <div className="text-slate-900 font-semibold">{debugInfo.crs}</div>
                </div>
              </div>

              {/* Pixel Breakdown */}
              <div className="bg-[#FFF9F4] p-3 rounded-lg border border-[#eeddd3] space-y-1.5">
                <div className="font-semibold text-slate-900 border-b border-[#eeddd3] pb-1">Raster Pixel Classification</div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Valid Pixels:</span>
                  <span className="text-slate-900 font-semibold">{debugInfo.validPixels.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[#FD1843] font-medium">
                  <span>Water Pixels:</span>
                  <span>{debugInfo.waterPixels.toLocaleString()} ({((debugInfo.waterPixels / (debugInfo.validPixels || 1)) * 100).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Vegetation Pixels:</span>
                  <span>{debugInfo.vegetationPixels.toLocaleString()} ({((debugInfo.vegetationPixels / (debugInfo.validPixels || 1)) * 100).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between text-rose-700 font-medium">
                  <span>Built-up Pixels:</span>
                  <span>{debugInfo.builtUpPixels.toLocaleString()} ({((debugInfo.builtUpPixels / (debugInfo.validPixels || 1)) * 100).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between text-amber-700 font-medium">
                  <span>Bare Soil Pixels:</span>
                  <span>{debugInfo.bareSoilPixels.toLocaleString()} ({((debugInfo.bareSoilPixels / (debugInfo.validPixels || 1)) * 100).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>NoData / Masked Pixels:</span>
                  <span>{debugInfo.nodataOrCloudPixels.toLocaleString()}</span>
                </div>
              </div>

              {/* Vector Geometry Breakdown */}
              <div className="bg-[#FFF9F4] p-3 rounded-lg border border-[#eeddd3] space-y-2">
                <div className="font-semibold text-slate-900 border-b border-[#eeddd3] pb-1 flex justify-between">
                  <span>Vector Geometries Derived</span>
                  <span className="text-[#FD1843] font-semibold">{debugInfo.finalVectorPolygonsCount} Polygons</span>
                </div>
                {debugInfo.polygonFeatures.length === 0 ? (
                  <div className="text-slate-500 italic py-1">No significant geographic component met the minimum area threshold. (0 features generated)</div>
                ) : (
                  <div className="space-y-1.5">
                    {debugInfo.polygonFeatures.map((poly) => (
                      <div key={poly.id} className="p-2 rounded bg-white border border-[#eeddd3] flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-900">{poly.label}</div>
                          <div className="text-[10px] text-slate-500">Category: {poly.category} | Confidence: unavailable</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[#FD1843] font-semibold">~{poly.areaHa} ha</div>
                          <div className="text-[10px] text-slate-500">{poly.areaSqM.toLocaleString()} m²</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#eeddd3] text-right">
              <button
                type="button"
                onClick={() => setShowDebugModal(false)}
                className="px-4 py-1.5 rounded-lg bg-[#FD1843] hover:bg-[#e01239] text-white font-semibold transition-colors shadow-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
