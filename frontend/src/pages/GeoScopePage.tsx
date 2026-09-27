import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Globe,
  Search,
  Crosshair,
  Layers,
  Sparkles,
  Send,
  Download,
  Calendar,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Maximize2,
  History,
  Eye,
  EyeOff,
  Filter,
  ArrowRightLeft,
  X,
  MapPin,
  Compass,
  Square,
  RotateCcw,
  MousePointer,
  HelpCircle,
  ZoomIn,
  ZoomOut,
  Maximize,
  Move,
  Plus,
  Minus,
  Upload
} from 'lucide-react';
import {
  processGeoScopeAOI,
  acquireGeoScopeImagery,
  analyzeGeoScopeAOI,
  compareGeoScopeDates,
  GeoScopeAOIResult,
  GeoScopeImageryResult,
  GeoScopeAnalysisResult,
  GeoScopeCompareResult
} from '../services/api.js';

interface GeoScopePageProps {
  onNavigateToAssistant?: (image: any, prompt?: string) => void;
}

export const GeoScopePage: React.FC<GeoScopePageProps> = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const uploadedLayerRef = useRef<L.LayerGroup | null>(null);
  const uploadedImageLayerRef = useRef<L.ImageOverlay | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadedImageUrlRef = useRef<string | null>(null);

  // Map & Search state
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState<string>('');
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [activeBaseLayer, setActiveBaseLayer] = useState<'satellite' | 'hybrid' | 'map' | 'terrain'>('satellite');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number }>({ lat: 13.0827, lng: 80.2707 });
  const [currentZoom, setCurrentZoom] = useState<number>(13);
  
  // Dedicated Drag Selection Overlay State
  const [isDrawOverlayActive, setIsDrawOverlayActive] = useState<boolean>(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrentPos, setDragCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const dragCanvasRef = useRef<HTMLDivElement>(null);

  // AOI State
  const [aoiData, setAoiData] = useState<GeoScopeAOIResult | null>(null);
  const [locationName, setLocationName] = useState<string>('Chennai Coastal & Port Area');
  const [sensor, setSensor] = useState<'Sentinel-2' | 'Sentinel-1'>('Sentinel-2');
  const [compositeType, setCompositeType] = useState<string>('RGB');
  const [maxCloudCover, setMaxCloudCover] = useState<number>(15);
  const [acquisitionDate, setAcquisitionDate] = useState<string>('2026-08-14');

  // Imagery & Analysis Pipeline State
  const [imageryData, setImageryData] = useState<GeoScopeImageryResult | null>(null);
  const [isAcquiringImagery, setIsAcquiringImagery] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<GeoScopeAnalysisResult | null>(null);

  // Q&A & History State
  const [userQuestion, setUserQuestion] = useState('');
  const [questionHistory, setQuestionHistory] = useState<Array<{ id: string; question: string; answer: string; confidence?: number; task: string; time: string }>>([]);

  // Temporal Compare Modal State
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [compareDateA, setCompareDateA] = useState('2026-01-15');
  const [compareDateB, setCompareDateB] = useState('2026-08-14');
  const [isComparing, setIsComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<GeoScopeCompareResult | null>(null);

  // Quick Preset Locations
  const presetLocations = [
    { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
    { name: 'Tamil Nadu Delta', lat: 10.7867, lng: 79.1378 },
    { name: 'Mumbai Coast', lat: 18.9220, lng: 72.8347 },
    { name: 'Delhi NCR', lat: 28.6139, lng: 77.2090 },
    { name: 'New York Harbor', lat: 40.7128, lng: -74.0060 },
    { name: 'Dhaka Basin', lat: 23.8103, lng: 90.4125 },
  ];

  // Initialize Leaflet Map with Deep Max Zoom Support (Up to Zoom 22 without missing tiles)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const container = mapContainerRef.current;

    // Default to Chennai, India
    const map = L.map(container, {
      center: [13.0827, 80.2707],
      zoom: 13,
      minZoom: 2,
      maxZoom: 22,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Base map first, then uploaded image layer, then AOI/annotation layers.
    // This keeps the local raster visible above the satellite background while preserving
    // the existing AOI and analysis overlay stack.
    const uploadedLayer = new L.LayerGroup();
    map.addLayer(uploadedLayer);
    uploadedLayerRef.current = uploadedLayer;

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    const ensureMapSize = () => {
      requestAnimationFrame(() => map.invalidateSize());
      setTimeout(() => map.invalidateSize(), 150);
    };

    map.whenReady(() => {
      ensureMapSize();
    });

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(() => {
        ensureMapSize();
      });
      resizeObserver.observe(container);
      (map as any)._resizeObserver = resizeObserver;
    }

    // Layer definitions with maxNativeZoom configured to seamlessly upscale tiles at maximum zoom levels
    const satelliteLayer = L.tileLayer(
      (import.meta as any).env?.VITE_SATELLITE_TILE_URL ||
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '&copy; Esri World Imagery &mdash; Earthstar Geographics',
        maxNativeZoom: 19,
        maxZoom: 22,
        crossOrigin: true,
      }
    );

    const hybridLayer = L.tileLayer(
      'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      {
        attribution: '&copy; Google Maps Hybrid Satellite',
        maxNativeZoom: 20,
        maxZoom: 22,
        crossOrigin: true,
      }
    );

    const osmLayer = L.tileLayer(
      (import.meta as any).env?.VITE_MAP_TILE_URL ||
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxNativeZoom: 19,
        maxZoom: 22,
        crossOrigin: true,
      }
    );

    const terrainLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '&copy; Esri World Topo Map',
        maxNativeZoom: 18,
        maxZoom: 22,
        crossOrigin: true,
      }
    );

    satelliteLayer.addTo(map);

    (map as any)._baseLayers = {
      satellite: satelliteLayer,
      hybrid: hybridLayer,
      map: osmLayer,
      terrain: terrainLayer,
    };

    // Track cursor coordinates and zoom level
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursorCoords({
        lat: parseFloat(e.latlng.lat.toFixed(4)),
        lng: parseFloat(e.latlng.lng.toFixed(4)),
      });
    });

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    mapInstanceRef.current = map;

    // Initial default AOI around Chennai
    const initialBounds: [number, number, number, number] = [80.2307, 13.0427, 80.3107, 13.1227];
    createAOIFromBounds(initialBounds, 'Chennai Central & Coastal Port Area', false);

    return () => {
      if ((map as any)._resizeObserver) {
        (map as any)._resizeObserver.disconnect();
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update base layer on switcher change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !(map as any)._baseLayers) return;

    const baseLayers = (map as any)._baseLayers;
    Object.values(baseLayers).forEach((layer: any) => map.removeLayer(layer));

    if (baseLayers[activeBaseLayer]) {
      baseLayers[activeBaseLayer].addTo(map);
    }

    requestAnimationFrame(() => {
      map.invalidateSize();
    });
  }, [activeBaseLayer]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = uploadedLayerRef.current;
    if (!map || !layerGroup) return;

    if (uploadedImageLayerRef.current) {
      layerGroup.removeLayer(uploadedImageLayerRef.current);
      uploadedImageLayerRef.current = null;
    }

    if (!uploadedImageUrl) return;

    const bounds = aoiData?.bounds
      ? [
          [aoiData.bounds[1], aoiData.bounds[0]],
          [aoiData.bounds[3], aoiData.bounds[2]],
        ]
      : [
          [map.getCenter().lat - 0.05, map.getCenter().lng - 0.05],
          [map.getCenter().lat + 0.05, map.getCenter().lng + 0.05],
        ];

    const overlay = L.imageOverlay(uploadedImageUrl, bounds as L.LatLngBoundsExpression, {
      opacity: 0.9,
      interactive: false,
    });
    overlay.addTo(layerGroup);
    overlay.bringToFront();
    uploadedImageLayerRef.current = overlay;
  }, [uploadedImageUrl, aoiData?.bounds]);

  useEffect(() => {
    return () => {
      if (uploadedImageUrlRef.current) {
        URL.revokeObjectURL(uploadedImageUrlRef.current);
        uploadedImageUrlRef.current = null;
      }
    };
  }, []);

  const handleUploadedImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isSupportedImage = file.type.startsWith('image/') || /\.(tif|tiff|png|jpg|jpeg)$/i.test(file.name);
    if (!isSupportedImage) {
      alert('Please choose a valid satellite or remote-sensing image (.png, .jpg, .jpeg, .tif, .tiff).');
      event.target.value = '';
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      alert('Image files must be 50 MB or smaller to analyze.');
      event.target.value = '';
      return;
    }

    if (uploadedImageUrlRef.current) {
      URL.revokeObjectURL(uploadedImageUrlRef.current);
      uploadedImageUrlRef.current = null;
    }

    const objectUrl = URL.createObjectURL(file);
    uploadedImageUrlRef.current = objectUrl;
    setUploadedImageUrl(objectUrl);
    setUploadedImageName(file.name);
    setUploadedImageFile(file);
    event.target.value = '';
  };

  const clearUploadedImage = () => {
    if (uploadedImageUrlRef.current) {
      URL.revokeObjectURL(uploadedImageUrlRef.current);
      uploadedImageUrlRef.current = null;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setUploadedImageUrl(null);
    setUploadedImageName('');
    setUploadedImageFile(null);
  };

  // Render AOI onto map synchronously and lock it
  const renderAOIOnMap = (bounds: [number, number, number, number], areaKm2: number) => {
    const [min_lon, min_lat, max_lon, max_lat] = bounds;
    const map = mapInstanceRef.current;
    if (!map || !drawnItemsRef.current) return;

    drawnItemsRef.current.clearLayers();
    const leafletBounds: L.LatLngBoundsExpression = [
      [min_lat, min_lon],
      [max_lat, max_lon],
    ];

    // Main AOI Rectangle with high visibility border
    const rectLayer = L.rectangle(leafletBounds, {
      color: '#FD1843',
      weight: 3,
      fillColor: '#FD1843',
      fillOpacity: 0.22,
      dashArray: '4, 4',
      interactive: true,
    });

    // Add permanent popup badge
    rectLayer.bindTooltip(`📍 Locked AOI: ${areaKm2.toFixed(2)} km²`, {
      permanent: true,
      direction: 'top',
      className: 'bg-slate-900 text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded shadow',
    });

    rectLayer.addTo(drawnItemsRef.current);

    // Corner control points
    const corners = [
      [min_lat, min_lon],
      [min_lat, max_lon],
      [max_lat, max_lon],
      [max_lat, min_lon]
    ];
    corners.forEach(([cLat, cLng]) => {
      L.circleMarker([cLat, cLng], {
        radius: 5,
        color: '#FD1843',
        fillColor: '#ffffff',
        fillOpacity: 1,
        weight: 2,
        interactive: false
      }).addTo(drawnItemsRef.current!);
    });
  };

  // Helper to calculate geodesic area locally (Haversine approximation)
  const calculateGeodesicArea = (bounds: [number, number, number, number]): number => {
    const [min_lon, min_lat, max_lon, max_lat] = bounds;
    const center_lat = (min_lat + max_lat) / 2.0;
    const width_km = Math.abs(max_lon - min_lon) * 111.32 * Math.cos((center_lat * Math.PI) / 180.0);
    const height_km = Math.abs(max_lat - min_lat) * 111.0;
    return Math.max(0.01, parseFloat((width_km * height_km).toFixed(3)));
  };

  // Helper to create AOI from Bounding Box (Never vanishes, locks immediately)
  const createAOIFromBounds = async (bounds: [number, number, number, number], name?: string, shouldFit = false) => {
    const [min_lon, min_lat, max_lon, max_lat] = bounds;
    const center = { lat: (min_lat + max_lat) / 2.0, lon: (min_lon + max_lon) / 2.0 };
    const areaKm2 = calculateGeodesicArea(bounds);

    const polygonCoords = [
      [min_lon, min_lat],
      [max_lon, min_lat],
      [max_lon, max_lat],
      [min_lon, max_lat],
      [min_lon, min_lat],
    ];

    const geojson = {
      type: 'Polygon',
      coordinates: [polygonCoords],
    };

    // 1. Immediately render on Leaflet so it never vanishes for the user
    renderAOIOnMap(bounds, areaKm2);

    // 2. Set local fallback aoiData immediately to unlock UI
    const immediateAoiData: GeoScopeAOIResult = {
      valid: true,
      area_km2: areaKm2,
      center,
      bounds,
      geometry: geojson,
      geojson: {
        type: 'Feature',
        properties: { area_km2: areaKm2, center, bounds, crs: 'EPSG:4326' },
        geometry: geojson
      },
      status: 'locked'
    };
    setAoiData(immediateAoiData);
    if (name) setLocationName(name);

    if (shouldFit && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds([
        [min_lat, min_lon],
        [max_lat, max_lon]
      ], { padding: [40, 40], maxZoom: 18 });
    }

    // 3. Acquire satellite imagery preview
    acquireImageryForCurrentAOI(bounds);

    // 4. Asynchronously refine with server-side geodesic calculation
    try {
      const aoiRes = await processGeoScopeAOI(geojson);
      if (aoiRes && aoiRes.valid) {
        setAoiData(aoiRes);
        renderAOIOnMap(bounds, aoiRes.area_km2);
      }
    } catch (err) {
      console.warn('Server AOI validation fallback to client computation:', err);
    }
  };

  // Quick Centered Box Size Generator
  const createPresetBoxAroundCenter = (sizeKm: number) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const center = map.getCenter();
    const sideKm = Math.sqrt(sizeKm);
    const deltaLat = (sideKm / 111.0) / 2.0;
    const deltaLon = (sideKm / (111.32 * Math.cos((center.lat * Math.PI) / 180.0))) / 2.0;
    const bounds: [number, number, number, number] = [
      center.lng - deltaLon,
      center.lat - deltaLat,
      center.lng + deltaLon,
      center.lat + deltaLat,
    ];
    createAOIFromBounds(bounds, `${sizeKm} km² Area (${center.lat.toFixed(3)}°N, ${center.lng.toFixed(3)}°E)`, false);
  };

  // Adjust AOI Size smoothly by multiplier (e.g. +20% with Plus or -20% with Minus)
  const handleScaleAOI = (factor: number) => {
    let boundsToScale = aoiData?.bounds;
    if (!boundsToScale) {
      if (!mapInstanceRef.current) return;
      const center = mapInstanceRef.current.getCenter();
      const delta = 0.025;
      boundsToScale = [center.lng - delta, center.lat - delta, center.lng + delta, center.lat + delta];
    }
    const [min_lon, min_lat, max_lon, max_lat] = boundsToScale;
    const center_lon = (min_lon + max_lon) / 2.0;
    const center_lat = (min_lat + max_lat) / 2.0;
    const half_span_lon = ((max_lon - min_lon) / 2.0) * factor;
    const half_span_lat = ((max_lat - min_lat) / 2.0) * factor;

    const newBounds: [number, number, number, number] = [
      center_lon - half_span_lon,
      center_lat - half_span_lat,
      center_lon + half_span_lon,
      center_lat + half_span_lat
    ];
    createAOIFromBounds(newBounds, locationName, false);
  };

  // Dedicated HTML5 Drag-Selection Handlers (Instant response, locks on release)
  const handleOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragCanvasRef.current) return;
    const rect = dragCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDragStartPos({ x, y });
    setDragCurrentPos({ x, y });
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleOverlayPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartPos || !dragCanvasRef.current) return;
    const rect = dragCanvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    setDragCurrentPos({ x, y });
  };

  const handleOverlayPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartPos || !dragCurrentPos || !mapInstanceRef.current || !dragCanvasRef.current) {
      setIsDrawOverlayActive(false);
      setDragStartPos(null);
      setDragCurrentPos(null);
      return;
    }

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const map = mapInstanceRef.current;
    const p1 = map.containerPointToLatLng(L.point(dragStartPos.x, dragStartPos.y));
    const p2 = map.containerPointToLatLng(L.point(dragCurrentPos.x, dragCurrentPos.y));

    const min_lon = Math.min(p1.lng, p2.lng);
    const max_lon = Math.max(p1.lng, p2.lng);
    const min_lat = Math.min(p1.lat, p2.lat);
    const max_lat = Math.max(p1.lat, p2.lat);

    const pixelDistance = Math.hypot(dragCurrentPos.x - dragStartPos.x, dragCurrentPos.y - dragStartPos.y);

    setIsDrawOverlayActive(false);
    setDragStartPos(null);
    setDragCurrentPos(null);

    // Apply as long as user dragged at least 5 pixels on screen
    if (pixelDistance >= 5 && Math.abs(max_lon - min_lon) > 0.00002 && Math.abs(max_lat - min_lat) > 0.00002) {
      createAOIFromBounds(
        [min_lon, min_lat, max_lon, max_lat],
        `Selected AOI (${min_lat.toFixed(4)}°N, ${min_lon.toFixed(4)}°E)`,
        false
      );
    }
  };

  // Acquire satellite imagery for AOI
  const acquireImageryForCurrentAOI = async (boundsOverride?: [number, number, number, number]) => {
    const targetBounds = boundsOverride || aoiData?.bounds;
    if (!targetBounds) return;

    setIsAcquiringImagery(true);
    try {
      const imgRes = await acquireGeoScopeImagery({
        bounds: targetBounds,
        sensor,
        acquisition_date: acquisitionDate,
        max_cloud_cover: maxCloudCover,
        composite_type: compositeType,
      });
      setImageryData(imgRes);
    } catch (err) {
      console.error('Imagery acquisition error:', err);
    } finally {
      setIsAcquiringImagery(false);
    }
  };

  // Handle Location Search / Geocoding
  const handleLocationSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = (customQuery || searchQuery).trim();
    if (!query) return;

    setIsSearching(true);

    // Check if query is raw lat, lon coordinates
    const coordMatch = query.match(/^([-+]?\d{1,2}(?:\.\d+)?),\s*([-+]?\d{1,3}(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      const delta = 0.04;
      const bounds: [number, number, number, number] = [lon - delta, lat - delta, lon + delta, lat + delta];
      createAOIFromBounds(bounds, `Coordinates (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
      setIsSearching(false);
      return;
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
        headers: { 'User-Agent': 'SatQueryAI-GeoScope/2.0' },
      });
      const data = await res.json();

      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        const delta = 0.035;
        const bounds: [number, number, number, number] = [lon - delta, lat - delta, lon + delta, lat + delta];
        createAOIFromBounds(bounds, item.display_name.split(',').slice(0, 2).join(', '));
      } else {
        alert(`Location '${query}' not found. Please verify spelling or try coordinates.`);
      }
    } catch (err) {
      console.warn('Geocoding fallback:', err);
      const fallback = presetLocations.find((p) => p.name.toLowerCase().includes(query.toLowerCase()));
      if (fallback) {
        const delta = 0.035;
        const bounds: [number, number, number, number] = [fallback.lng - delta, fallback.lat - delta, fallback.lng + delta, fallback.lat + delta];
        createAOIFromBounds(bounds, fallback.name);
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Run VLM Analysis on the Selected AOI
  const handleAnalyzeAOI = async (overridePrompt?: string) => {
    const activeQuestion = (overridePrompt || userQuestion || 'What type of land cover and dominant features are visible in this area?').trim();
    
    // 1. Ensure we have an AOI. If none exists, create one from current map center automatically
    let activeAoi = aoiData;
    if (!activeAoi) {
      if (mapInstanceRef.current) {
        const center = mapInstanceRef.current.getCenter();
        const delta = 0.025;
        const bounds: [number, number, number, number] = [center.lng - delta, center.lat - delta, center.lng + delta, center.lat + delta];
        await createAOIFromBounds(bounds, 'Auto-Selected Area', false);
        activeAoi = {
          valid: true,
          area_km2: calculateGeodesicArea(bounds),
          center: { lat: center.lat, lon: center.lng },
          bounds,
          geometry: {},
          status: 'locked'
        };
      } else {
        alert('Please select an Area of Interest (AOI) on the map first.');
        return;
      }
    }

    setIsAnalyzing(true);
    setAnalysisStage('1. Processing Selected AOI Geometry...');

    try {
      // 2. Fetch imagery if not yet loaded
      let activeImage = imageryData?.image_data_url;
      let activeMeta: Record<string, any> | undefined = imageryData?.metadata;

      if (uploadedImageFile) {
        setAnalysisStage('2. Loading Uploaded Image...');
        activeImage = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') resolve(reader.result);
            else reject(new Error('Could not read the selected image file.'));
          };
          reader.onerror = () => reject(reader.error || new Error('Could not read the selected image file.'));
          reader.readAsDataURL(uploadedImageFile);
        });
        activeMeta = {
          file_name: uploadedImageFile.name,
          sensor,
          bands: [],
        };
      }

      if (!activeImage && activeAoi.bounds) {
        setAnalysisStage('2. Acquiring High-Resolution Satellite Raster...');
        try {
          const imgRes = await acquireGeoScopeImagery({
            bounds: activeAoi.bounds,
            sensor,
            acquisition_date: acquisitionDate,
            max_cloud_cover: maxCloudCover,
            composite_type: compositeType,
          });
          if (imgRes && imgRes.image_data_url) {
            setImageryData(imgRes);
            activeImage = imgRes.image_data_url;
            activeMeta = imgRes.metadata;
          }
        } catch (imgErr) {
          console.warn('On-the-fly satellite imagery acquisition fallback:', imgErr);
        }
      }

      setAnalysisStage('3. Preprocessing Multispectral Bands...');
      await new Promise((r) => setTimeout(r, 200));

      setAnalysisStage('4. Measuring Uploaded Image Pixels and Spectral Bands...');
      await new Promise((r) => setTimeout(r, 300));

      setAnalysisStage('5. Generating Evidence-Grounded Answer...');

      const result = await analyzeGeoScopeAOI({
        question: activeQuestion,
        image: activeImage,
        aoi_geojson: activeAoi.geojson || activeAoi.geometry,
        metadata: activeMeta || { bounds: activeAoi.bounds },
      });

      setAnalysisResult(result);

      // Add to Q&A History
      const historyItem = {
        id: result.analysis_id || `q_${Date.now()}`,
        question: activeQuestion,
        answer: result.answer,
        confidence: result.confidence,
        task: result.task,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setQuestionHistory((prev) => [historyItem, ...prev]);
      setUserQuestion('');
    } catch (err: any) {
      console.error('GeoScope analysis failed:', err);
      alert(`Analysis failed: ${err.message || 'Please check network connection'}`);
    } finally {
      setIsAnalyzing(false);
      setAnalysisStage('');
    }
  };

  // Run Bi-Temporal Date Comparison
  const handleRunTemporalComparison = async () => {
    if (!aoiData?.bounds) return;

    setIsComparing(true);
    try {
      const compRes = await compareGeoScopeDates({
        bounds: aoiData.bounds,
        date_a: compareDateA,
        date_b: compareDateB,
        question: `What land cover and environmental changes occurred between ${compareDateA} and ${compareDateB}?`,
      });
      setCompareResult(compRes);
    } catch (err: any) {
      console.error('Temporal comparison error:', err);
      alert(`Comparison failed: ${err.message}`);
    } finally {
      setIsComparing(false);
    }
  };

  // Export AOI as GeoJSON
  const handleExportGeoJSON = () => {
    if (!aoiData?.geojson) return;
    const blob = new Blob([JSON.stringify(aoiData.geojson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GeoScope_AOI_${locationName.replace(/[^a-zA-Z0-9]/g, '_')}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Clear current AOI and reset
  const handleClearAOI = () => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
    }
    setAoiData(null);
    setImageryData(null);
    setAnalysisResult(null);
    setIsDrawOverlayActive(false);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.dragging.enable();
    }
  };

  // Calculate live drag box dimensions in pixels
  const dragRectStyle = dragStartPos && dragCurrentPos ? {
    left: Math.min(dragStartPos.x, dragCurrentPos.x),
    top: Math.min(dragStartPos.y, dragCurrentPos.y),
    width: Math.abs(dragCurrentPos.x - dragStartPos.x),
    height: Math.abs(dragCurrentPos.y - dragStartPos.y),
  } : null;

  return (
    <div className="flex flex-col space-y-6 pb-12">
      {/* 1. Header Section */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#eeddd3] pb-5 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FD1843]/10 text-[#FD1843]">
              <Globe className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">GeoScope</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Map Ready
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-slate-600">
            Explore the Earth. Select an Area. Ask Anything.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsCompareModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-[#eeddd3] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:border-[#FD1843]/40 hover:text-[#FD1843] transition-all cursor-pointer"
          >
            <ArrowRightLeft className="h-3.5 w-3.5 text-[#FD1843]" />
            Compare Dates
          </button>

          <button
            onClick={handleExportGeoJSON}
            disabled={!aoiData}
            className="inline-flex items-center gap-2 rounded-xl border border-[#eeddd3] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:border-[#FD1843]/40 hover:text-[#FD1843] disabled:opacity-50 transition-all cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            Export GeoJSON
          </button>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#eeddd3] bg-white p-3 shadow-xs">
        <form onSubmit={handleLocationSearch} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search a location, city, landmark or coordinates (e.g. Chennai, Mumbai, 23.8103, 90.4125)..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#FD1843] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FD1843]/10"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="rounded-xl bg-[#FD1843] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#e0143a] disabled:opacity-50 transition-all cursor-pointer"
          >
            {isSearching ? 'Locating...' : 'Locate'}
          </button>
        </form>

        {/* Quick Location Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs text-slate-500">
          <span className="shrink-0 font-medium text-slate-400">Quick Presets:</span>
          {presetLocations.map((loc) => (
            <button
              key={loc.name}
              onClick={() => handleLocationSearch(undefined, loc.name)}
              className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium hover:border-[#FD1843]/40 hover:bg-[#FD1843]/5 hover:text-[#FD1843] transition-all cursor-pointer"
            >
              {loc.name}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Split View: Interactive Map & AOI AI Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Interactive Map (7 Cols) */}
        <div className="flex flex-col gap-3 lg:col-span-7">
          <div className="relative h-[560px] w-full overflow-hidden rounded-2xl border border-[#eeddd3] bg-slate-100 shadow-sm">
            {/* Map Container */}
            <div ref={mapContainerRef} className="h-full w-full" />

            {/* Dedicated HTML5 Drag-Selection Canvas Overlay (Activated when Drawing AOI) */}
            {isDrawOverlayActive && (
              <div
                ref={dragCanvasRef}
                onPointerDown={handleOverlayPointerDown}
                onPointerMove={handleOverlayPointerMove}
                onPointerUp={handleOverlayPointerUp}
                className="absolute inset-0 z-[1500] cursor-crosshair select-none bg-black/10 backdrop-blur-[0.5px]"
              >
                {/* Visual Drag Bounding Box */}
                {dragRectStyle && (
                  <div
                    style={dragRectStyle}
                    className="absolute border-2 border-dashed border-[#FD1843] bg-[#FD1843]/20 shadow-lg pointer-events-none"
                  >
                    <div className="absolute -top-7 left-0 rounded-md bg-[#FD1843] px-2 py-0.5 text-[10px] font-mono font-bold text-white shadow-sm">
                      Demarcating AOI
                    </div>
                  </div>
                )}

                {/* Instructions Hint */}
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-1.5 text-xs font-semibold text-white shadow-md backdrop-blur-xs">
                  Click and drag across the map to select your Area of Interest
                </div>
              </div>
            )}

            {/* Floating Top Controls: Basemap Switcher & Drawing Toolbar */}
            <div className="absolute left-3.5 top-3.5 z-[1000] flex flex-wrap items-center gap-2">
              {/* Basemap Switcher */}
              <div className="flex items-center rounded-xl border border-slate-200 bg-white/95 p-1 shadow-md backdrop-blur-xs">
                {(['satellite', 'hybrid', 'map', 'terrain'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setActiveBaseLayer(mode)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold capitalize transition-all cursor-pointer ${
                      activeBaseLayer === mode
                        ? 'bg-[#FD1843] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* Draw Rectangle AOI Trigger */}
              <div className="flex items-center rounded-xl border border-slate-200 bg-white/95 p-1 shadow-md backdrop-blur-xs">
                <button
                  onClick={() => setIsDrawOverlayActive(!isDrawOverlayActive)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                    isDrawOverlayActive
                      ? 'bg-[#FD1843] text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Crosshair className={`h-3.5 w-3.5 ${isDrawOverlayActive ? 'text-white' : 'text-[#FD1843]'}`} />
                  {isDrawOverlayActive ? 'Cancel Selection' : 'Drag to Select AOI'}
                </button>
              </div>

              {/* Quick Box Generator */}
              <div className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-md backdrop-blur-xs text-[11px] font-semibold text-slate-600">
                <span className="px-1 text-slate-400">Box:</span>
                {[5, 15, 50].map((size) => (
                  <button
                    key={size}
                    onClick={() => createPresetBoxAroundCenter(size)}
                    className="rounded-md bg-slate-100 px-2 py-0.5 hover:bg-[#FD1843]/10 hover:text-[#FD1843] transition-all cursor-pointer"
                  >
                    {size} km²
                  </button>
                ))}
              </div>
            </div>

            {/* Floating Top-Right Controls */}
            <div className="absolute right-3.5 top-14 z-[1000] flex flex-col gap-1.5">
              <button
                onClick={() => setIsDrawOverlayActive(true)}
                title="Drag to select new Area of Interest"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-md hover:bg-[#FD1843]/10 hover:text-[#FD1843] text-slate-700 transition-all cursor-pointer"
              >
                <Square className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleScaleAOI(1.20)}
                title="Expand AOI Area (+20%)"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-md hover:bg-[#FD1843]/10 hover:text-[#FD1843] text-slate-700 transition-all cursor-pointer font-bold text-xs"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleScaleAOI(0.833)}
                title="Shrink AOI Area (-20%)"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-md hover:bg-[#FD1843]/10 hover:text-[#FD1843] text-slate-700 transition-all cursor-pointer font-bold text-xs"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                onClick={handleClearAOI}
                title="Clear current AOI selection"
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-md hover:bg-slate-100 hover:text-slate-900 text-slate-500 transition-all cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>

            {/* Floating Bottom Bar: Live Cursor Coordinates & Zoom Level */}
            <div className="absolute bottom-3 left-3.5 right-3.5 z-[1000] flex items-center justify-between rounded-xl border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] font-mono font-medium text-slate-600 shadow-md backdrop-blur-xs">
              <div className="flex items-center gap-3">
                <span>LAT: <strong className="text-slate-900">{cursorCoords.lat}° N</strong></span>
                <span>LON: <strong className="text-slate-900">{cursorCoords.lng}° E</strong></span>
                <span className="text-slate-400">Zoom: {currentZoom}x (Max 22x)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">High-Res Satellite</span>
                <span className="h-2 w-px bg-slate-300" />
                <span className="font-semibold text-[#FD1843] truncate max-w-[180px]">{locationName}</span>
              </div>
            </div>
          </div>

          {/* Selected AOI Status Banner */}
          {aoiData ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#eeddd3] bg-white p-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FD1843]/10 text-[#FD1843]">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{locationName}</h4>
                  <p className="text-[11px] font-mono text-slate-500">
                    Area: <span className="font-bold text-[#FD1843]">{aoiData.area_km2} km²</span> | Center: {aoiData.center.lat.toFixed(4)}°N, {aoiData.center.lon.toFixed(4)}°E
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsDrawOverlayActive(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#FD1843]/30 bg-[#FD1843]/5 px-2.5 py-1 text-xs font-bold text-[#FD1843] hover:bg-[#FD1843] hover:text-white transition-all cursor-pointer"
                >
                  <Crosshair className="h-3 w-3" />
                  Drag New AOI
                </button>
                <button
                  onClick={() => acquireImageryForCurrentAOI()}
                  disabled={isAcquiringImagery}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-[#FD1843]/40 transition-all cursor-pointer"
                >
                  <RefreshCw className={`h-3 w-3 ${isAcquiringImagery ? 'animate-spin text-[#FD1843]' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-dashed border-[#eeddd3] bg-white/70 p-3.5 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <MousePointer className="h-4 w-4 text-[#FD1843]" />
                <span>No Area of Interest demarcated yet. Click below to drag-select any region on the map.</span>
              </div>
              <button
                onClick={() => setIsDrawOverlayActive(true)}
                className="rounded-lg bg-[#FD1843] px-3.5 py-1.5 font-bold text-white shadow-xs hover:bg-[#e0143a] transition-all cursor-pointer"
              >
                Drag Box Now
              </button>
            </div>
          )}
        </div>

        {/* Right Column: AOI Configuration & AI Analysis Assistant (5 Cols) */}
        <div className="flex flex-col space-y-4 lg:col-span-5">
          {/* AOI Parameters & Acquisition Card */}
          <div className="rounded-2xl border border-[#eeddd3] bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-[#FD1843]" />
                <h3 className="text-sm font-bold text-slate-900">Acquisition Parameters</h3>
              </div>
              <span className="text-[11px] font-medium text-slate-500">Sentinel-2 / 1 Multispectral</span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="col-span-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.tif,.tiff,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleUploadedImageSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#FD1843]/30 bg-[#FD1843]/5 px-2.5 py-1.5 text-[11px] font-bold text-[#FD1843] transition-all hover:bg-[#FD1843] hover:text-white cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload image
                </button>
                <span className="truncate text-[11px] font-medium text-slate-600">
                  {uploadedImageName || 'No local image overlay'}
                </span>
                {uploadedImageUrl && (
                  <button
                    type="button"
                    onClick={clearUploadedImage}
                    className="ml-auto rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-[#FD1843] cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Sensor Selection */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Sensor / Modality</label>
                <select
                  value={sensor}
                  onChange={(e) => setSensor(e.target.value as any)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-[#FD1843] focus:outline-none"
                >
                  <option value="Sentinel-2">Sentinel-2 (Optical 10m)</option>
                  <option value="Sentinel-1">Sentinel-1 (SAR C-Band)</option>
                </select>
              </div>

              {/* Composite Type */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Composite</label>
                <select
                  value={compositeType}
                  onChange={(e) => setCompositeType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-[#FD1843] focus:outline-none"
                >
                  <option value="RGB">True Color (RGB)</option>
                  <option value="False Color (NIR)">False Color (NIR/Vegetation)</option>
                  <option value="NDVI Proxy">NDVI Mask Proxy</option>
                </select>
              </div>

              {/* Max Cloud Cover */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Max Cloud Cover: {maxCloudCover}%</label>
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={maxCloudCover}
                  onChange={(e) => setMaxCloudCover(parseInt(e.target.value))}
                  className="mt-1.5 w-full accent-[#FD1843]"
                />
              </div>

              {/* Acquisition Date */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Target Date</label>
                <input
                  type="date"
                  value={acquisitionDate}
                  onChange={(e) => setAcquisitionDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-900 focus:border-[#FD1843] focus:outline-none"
                />
              </div>
            </div>

            {/* Imagery Preview Box */}
            {imageryData && (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1.5">
                  <span>Clipped AOI Satellite Raster</span>
                  <span className="font-semibold text-slate-700">{imageryData.metadata.dimensions}</span>
                </div>
                <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-slate-950">
                  <img
                    src={imageryData.image_data_url}
                    alt="AOI Satellite Capture"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-mono text-white backdrop-blur-xs">
                    {imageryData.metadata.sensor} &bull; Cloud: {imageryData.metadata.cloud_percentage}%
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Ask SatQueryAI Analysis Assistant */}
          <div className="flex flex-col rounded-2xl border border-[#eeddd3] bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#FD1843]" />
                <h3 className="text-sm font-bold text-slate-900">Ask SatQueryAI</h3>
              </div>
              <span className="text-[11px] font-medium text-slate-500">Gemini 3.8 + BigEarthNet</span>
            </div>

            {/* Natural-Language Prompt Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAnalyzeAOI();
              }}
              className="mt-3"
            >
              <div className="relative">
                <textarea
                  rows={2}
                  value={userQuestion}
                  onChange={(e) => setUserQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAnalyzeAOI();
                    }
                  }}
                  placeholder="Ask a question about this selected area (e.g. What type of land cover is visible? Are water bodies present?)..."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 p-3 pr-10 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#FD1843] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FD1843]/10"
                />
                <button
                  type="submit"
                  disabled={isAnalyzing}
                  title="Send Question"
                  className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-lg bg-[#FD1843] text-white shadow-xs hover:bg-[#e0143a] disabled:opacity-40 transition-all cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>

            {/* Quick Question Chips */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {[
                'What type of land cover is visible?',
                'Is there significant vegetation?',
                'Are there signs of urban development?',
                'Are water bodies present?',
                'What agricultural patterns can you identify?',
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleAnalyzeAOI(prompt)}
                  disabled={isAnalyzing}
                  className="rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-[#FD1843]/40 hover:bg-[#FD1843]/5 hover:text-[#FD1843] disabled:opacity-50 transition-all cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Analyze Selected Area Big CTA Button */}
            <button
              onClick={() => handleAnalyzeAOI()}
              disabled={isAnalyzing}
              className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FD1843] py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#e0143a] disabled:opacity-50 transition-all cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              {isAnalyzing ? 'Running Remote-Sensing Analysis...' : 'Analyze Selected Area'}
            </button>

            {/* Analysis Progress / Stages */}
            {isAnalyzing && (
              <div className="mt-4 rounded-xl border border-[#FD1843]/20 bg-[#FD1843]/5 p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#FD1843]">
                  <Sparkles className="h-4 w-4 animate-spin" />
                  {analysisStage || 'Analyzing Satellite Acquisition...'}
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-2/3 animate-pulse bg-[#FD1843]" />
                </div>
              </div>
            )}

            {/* Analysis Result Card */}
            {analysisResult && !isAnalyzing && (
              <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                {/* Result Header */}
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="rounded-md bg-[#FD1843]/10 px-2 py-0.5 text-[11px] font-bold text-[#FD1843]">
                    {analysisResult.task.toUpperCase()}
                  </span>
                  {typeof analysisResult.confidence === 'number' ? (
                    <span className="text-xs font-mono font-semibold text-slate-700">
                      Confidence: <strong className="text-emerald-600 font-bold">{(analysisResult.confidence * 100).toFixed(1)}%</strong>
                    </span>
                  ) : (
                    <span className="text-xs font-mono font-semibold text-slate-500">Confidence: not calibrated</span>
                  )}
                </div>

                {/* Direct Answer */}
                <p className="text-xs font-medium leading-relaxed text-slate-900">
                  {analysisResult.answer}
                </p>

                {/* Detected Feature Tags */}
                {analysisResult.detected_features && analysisResult.detected_features.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-slate-500">Features:</span>
                    {analysisResult.detected_features.map((feat) => (
                      <span
                        key={feat}
                        className="rounded-md bg-slate-200/70 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-800"
                      >
                        {feat}
                      </span>
                    ))}
                  </div>
                )}

                {/* Evidence Bullets */}
                {analysisResult.evidence && (
                  <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] text-slate-700">
                    <div className="font-bold text-slate-900">Visual & Spectral Evidence:</div>
                    {analysisResult.evidence.map((ev, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#FD1843]" />
                        <span>{ev}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Overlay Mask / Result Preview */}
                {analysisResult.visual_result && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                      <span>Semantic Segmentation Mask</span>
                      <span className="text-[10px] text-slate-400">Coverage: {analysisResult.statistics?.coverage_percentage || 0}%</span>
                    </div>
                    <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-black">
                      <img
                        src={analysisResult.visual_result}
                        alt="Segmentation Overlay"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                )}

                {/* Metadata & Trace Footer */}
                <div className="flex flex-wrap items-center justify-between gap-1 border-t border-slate-200/80 pt-2 text-[10px] font-mono text-slate-500">
                  <span>ID: {analysisResult.analysis_id?.slice(0, 16)}</span>
                  <span>Model: {analysisResult.model}</span>
                  <span>Time: {analysisResult.processing_time}s</span>
                </div>
              </div>
            )}

            {/* Question History for Current AOI */}
            {questionHistory.length > 1 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                  <History className="h-3.5 w-3.5 text-[#FD1843]" />
                  <span>Previous Questions on this AOI</span>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {questionHistory.slice(1).map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                      <div className="font-semibold text-slate-800">Q: {item.question}</div>
                      <div className="mt-1 text-slate-600 line-clamp-2">A: {item.answer}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Bi-Temporal Date Comparison Modal */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-[#eeddd3] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-[#FD1843]" />
                <h3 className="text-base font-bold text-slate-900">Bi-Temporal AOI Change Detection</h3>
              </div>
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-600">
              Select two acquisition dates for <strong>{locationName}</strong> to perform co-registered multi-epoch satellite change detection.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">Date A (Baseline Epoch)</label>
                <input
                  type="date"
                  value={compareDateA}
                  onChange={(e) => setCompareDateA(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium text-slate-900 focus:border-[#FD1843] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Date B (Recent Epoch)</label>
                <input
                  type="date"
                  value={compareDateB}
                  onChange={(e) => setCompareDateB(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium text-slate-900 focus:border-[#FD1843] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRunTemporalComparison}
                disabled={isComparing}
                className="rounded-xl bg-[#FD1843] px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#e0143a] disabled:opacity-50 cursor-pointer"
              >
                {isComparing ? 'Comparing Epochs...' : 'Run Change Analysis'}
              </button>
            </div>

            {/* Comparison Results */}
            {compareResult && (
              <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <span>Change Metric: <strong className="text-[#FD1843]">{compareResult.change_metric_pct}%</strong></span>
                  <span className="text-emerald-700">Confidence: {(compareResult.confidence * 100).toFixed(0)}%</span>
                </div>
                <p className="text-xs text-slate-800 leading-relaxed">{compareResult.answer}</p>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 mb-1">Epoch A ({compareResult.date_a})</div>
                    <img src={compareResult.image_a_url} alt="Epoch A" className="h-28 w-full rounded-lg object-cover border border-slate-200" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 mb-1">Epoch B ({compareResult.date_b})</div>
                    <img src={compareResult.image_b_url} alt="Epoch B" className="h-28 w-full rounded-lg object-cover border border-slate-200" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
