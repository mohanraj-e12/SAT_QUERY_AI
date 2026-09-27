# SatQueryAI Image-Analysis Accuracy Audit

## Executive verdict

**Conditional / not validated for operational remote-sensing decisions.** The main single-image query path now derives its reported pixel measurements from the uploaded image bytes. RGB files receive explicitly qualified color-heuristic estimates; true indices are only returned when the required bands can be mapped. These are deterministic estimates, not a trained land-cover model, and have not been validated against independent ground truth.

The audit found reachable legacy inference paths and unsupported model/evaluation claims outside that deterministic query path. Do not present those outputs as trained-model predictions or measured benchmark performance until the implementations and claims are reconciled.

## Scope and pipeline trace

The Assistant query sends the selected image context and question to the analysis API. The backend passes the image payload to the Python agentic bridge. For a single image, the Python orchestrator validates the input, calls `analyze_satellite_image()`, creates a question-specific response with `generate_analysis_summary()`, and returns the measured `image_analysis`, statistics, and overlays. The active single-image route returns before the legacy specialist-model branches.

`image_analysis.py` decodes data URLs, supported local paths, or image URLs; limits input to 50 MiB; caps the working image side at 512 pixels; reads GeoTIFF rasters with Rasterio where possible; applies nodata masks; maps bands; computes available indices; and creates image-derived class masks and overlays. RGB rasters are analyzed using RGB color features only.

## Findings and corrections

### Corrected in this audit

- **RGB preview presented as a true spectral index (Explorer):** the browser canvas only exposes rendered RGB pixels, but its green/red or channel-color proxies were displayed as NDVI, NDWI, and NDBI. Explorer now labels these as RGB estimates, explains the required bands in the formula copy, and no longer describes the area as a measured index.
- **Invented map confidence:** the browser feature extractor converted RGB thresholds into values in the 0.80–0.98 range and presented them as model confidence. Those confidence values have been removed from its automatically generated detections and debug records; map popups no longer call them model confidence.
- **Invented ground area:** Explorer assigned `0.25 ha` per canvas pixel irrespective of image resolution. That total-area calculation was removed. Geodesic feature areas shown by map extraction still depend on a valid supplied geographic bounding box and are approximate at the extractor's 256-by-256 working resolution.
- **Synthetic pixel totals:** the chart's one-million-pixel fallback and derived fallback counts were removed. It now uses measured counts or displays unavailable.
- **Unmapped multispectral data reported as zero coverage:** a raster with no mapped RGB or usable index bands previously appeared to contain 0% water/vegetation/built-up and 100% bare land. Per-class availability is now explicit; unsupported values serialize as unavailable and the UI does not render them as zero. Question summaries state the band limitation, and paired coverage comparisons are skipped unless every compared class is measurable in both images.
- **Landsat band mapping with platform names containing spaces:** Landsat-8/9 band-role detection previously matched only hyphenated platform names and omitted Landsat B2 blue. Platform names are normalized and B2 is mapped as blue; a Landsat 8 regression test covers the standard B2–B6 roles.
- **Misleading map evidence labels:** frontend feature extraction only reads RGB pixels, even when the metadata lists NIR/SWIR. It no longer reports those heuristics as NDVI/NDWI/NDBI evidence.

### Remaining accuracy and integrity findings

| Area | Audit result | Impact / limitation |
|---|---|---|
| RGB classification | Threshold-based visual-color heuristics | Water, vegetation, and built-up coverage are estimates, sensitive to color correction, shadows, season, haze, and scene content. They are not spectral indices or a supervised land-cover classification. |
| Multispectral indices | Computed from mapped raster bands: NDVI `(NIR-Red)/(NIR+Red)`, NDWI `(Green-NIR)/(Green+NIR)`, MNDWI `(Green-SWIR)/(Green+SWIR)`, NDBI `(SWIR-NIR)/(SWIR+NIR)` | Availability depends on correct band descriptions or metadata. Water/vegetation/built-up masks use simple thresholds (water index `> 0`, NDVI `> 0.2`, NDBI `> 0`) and priority assignment; those thresholds are not calibrated to a sensor, biome, or ground-truth dataset. |
| Land-cover model status | The main query uses deterministic indices/thresholds or RGB heuristics, not a trained per-pixel classifier | Do not describe its class percentages as model predictions or imply supervised accuracy. Current responses include a method/confidence basis that identifies this limitation. |
| Satellite authenticity | Validator checks selected filename/metadata signals, then defaults to accepting otherwise unrecognized files | It cannot authenticate satellite provenance or reliably reject ordinary photos. “Valid satellite” is not a scientifically verified property under this check. |
| BigEarthNet VLM | `bigearthnet_weights.json` claims `trained: true` and reports benchmark metrics. The implementation describes feature extraction as simulated and generates class scores from image ID/location/platform-derived hashes and location rules, not image pixels. The authenticated `evaluate-uploaded` route and UI modal call this implementation. | The training and benchmark claims are not supported by this implementation. Keep these outputs out of accuracy claims unless replaced by a verified checkpoint and evaluation. |
| VRSBench inference | The inference endpoint can return canned question-pattern answers when Torch is unavailable; the VQA engine can substitute a gray image and return success-shaped output. Its confidence values are fixed by checkpoint presence, not calibrated against predictions | Do not treat these responses or confidence values as evidence about the uploaded image. This is an alternate inference route, not the active deterministic Assistant single-image route. |
| Legacy specialist outputs | Legacy optical/SAR, change-detection, grounding, and other specialist implementations contain synthetic/default outputs or fixed confidence/geometry values | These implementations are outside the active deterministic single-image route; reachability varies by alternate/evaluation path and was not verified for every specialist. Do not advertise them as real model analysis without checking each endpoint and replacing unsupported outputs. |
| Benchmark display | The Python bridge's `get_evaluation_criteria` action passes fixed benchmark scores into the composite-score calculation instead of running evaluation on the selected model/data | Treat these values as configured/sample inputs, not measured current-model performance. |
| Legacy frontend metrics | `frontend/src/utils/spectral.ts` contains fixed example percentages and confidence, but no imports from `frontend/src` were found during the audit | It appears unwired today; remove or label it before reuse so those sample measurements cannot be mistaken for analysis output. |
| Change detection | The active paired-image route compares image-wide class coverage only and explicitly disclaims pixel-aligned change. Compatibility currently does not establish common CRS, resolution, footprint, or co-registration | This is a coverage comparison, not spatial land-conversion detection. No pixel-level change map should be inferred from it. |
| PDF parity | The report service copies analysis statistics and `imageAnalysis` from the stored session result | Data lineage is shared, but an authenticated live website-versus-PDF parity check was not completed. |

## Tests and evidence

The Python suite uses constructed RGB and GeoTIFF pixel patterns, not independently labeled satellite scenes. It exercises image-dependent water/vegetation coverage, RGB NDVI limitation, multispectral NDVI and water indices, nodata, overlay generation, unsupported band mappings, and Landsat 8 band mapping.

- Backend Python tests: **18 passed**.
- Backend TypeScript build: **passed**.
- Repository-root production build (Vite frontend and bundled server): **passed**.
- The `frontend` package's own build script ran TypeScript checking successfully but its Vite stage failed because `frontend/index.html` is absent. The repository-root build is the functioning application build and completed successfully.
- The production bundle reports an existing large-chunk warning (>500 kB).
- The local browser was limited to the unauthenticated sign-in screen, so authenticated upload, map, console/network, and PDF workflows were **not verified** in this audit.

## Remaining limitations

1. No independent ground-truth dataset or held-out evaluation was run. Passing synthetic fixtures verifies code behavior, not scientific accuracy.
2. Class thresholds and RGB heuristics need sensor- and task-specific calibration before operational use.
3. RGB imagery cannot provide true NDVI; missing multispectral bands now remain unavailable instead of being invented.
4. A stored geographic bounding box is not proof of correct georeferencing; area and geographic placements require trustworthy image georeferencing.
5. Index pixels with unusable near-zero denominators are omitted from that index's statistics; class percentages still use the image's valid-pixel denominator, so denominator-invalid pixels can affect threshold-based coverage estimates.
6. Paired coverage changes do not provide spatial change detection, and no image co-registration or footprint equivalence is asserted.
7. Legacy VLM, model-metric, evaluation, and authenticity claims remain separate follow-up work; the core deterministic analysis does not make those claims valid.

## Final assessment

Use the main deterministic path only as an experimental image-derived measurement workflow. It can calculate valid spectral indices when named bands are available and can produce qualified RGB color estimates otherwise. It is **not** a validated classifier, object detector, authenticity verifier, change-detection model, or benchmark-verified trained VLM. Keep that distinction visible in the product and technical documentation.
