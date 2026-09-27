import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, FileText, Globe, X, ShieldAlert, Satellite } from 'lucide-react';
import { Project, SatelliteImage } from '../types/index.js';
import { imageService } from '../services/image.service.js';
import { validateSatelliteAuthenticityAPI, ClientValidationResult } from '../utils/satelliteValidator.js';

interface ImageUploaderProps {
  projects: Project[];
  activeProjectId?: string | null;
  onSuccess?: (image: SatelliteImage) => void;
  onCancel?: () => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  projects,
  activeProjectId,
  onSuccess,
  onCancel,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>(activeProjectId || (projects[0]?.id || ''));
  const [source, setSource] = useState<string>('Sentinel-2 L2A');
  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ClientValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  // Single preview helper: keep only a lightweight blob object URL in state.
  // Works for JPG/PNG; TIFF display depends on browser support. Never store
  // base64 data URLs in state — the original File is converted only at upload time.
  const useFilePreviewUrl = (file: File) => {
    try {
      if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
    } catch { /* ignore revoke errors */ }
    const next = URL.createObjectURL(file);
    previewObjectUrlRef.current = next;
    setPreviewUrl(next);
  };

  // Revoke object URL only on unmount / file change, never during render.
  React.useEffect(() => {
    return () => {
      try {
        if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
      } catch { /* ignore */ }
    };
  }, []);

  const setSelected = (file: File | null) => {
    setSelectedFile(file);
    if (!file) {
      try {
        if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
      } catch { /* ignore */ }
      previewObjectUrlRef.current = null;
      setPreviewUrl(null);
    }
  };

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    setValidationResult(null);
    setSelected(null);
    const validExts = ['.jpg', '.jpeg', '.png', '.tif', '.tiff'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExts.includes(ext)) {
      setErrorMsg(`Unsupported file type '${ext}'. Please upload .jpg, .jpeg, .png, or .tif/.tiff.`);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg('File size exceeds the 50MB maximum limit.');
      return;
    }

    setSelected(file);
    useFilePreviewUrl(file);
    setIsValidating(true);

    // Run satellite image verification check using the validated file bytes.
    // Preview stays as the lightweight blob URL above (TIFF preview depends
    // on browser support); never overwrite it with a base64 data URL.
    try {
      const val = await validateSatelliteAuthenticityAPI(file);
      setValidationResult(val);
      if (val.status === 'INVALID' || !val.isValid) {
        setErrorMsg(val.reason || `Invalid Image: The selected file does not appear to be an Earth observation or satellite image (${val.detectedType}). Please submit a valid satellite image.`);
      } else {
        setErrorMsg(null);
      }
    } catch {
      setValidationResult({
        status: 'UNAVAILABLE',
        isValid: true,
        isAuthentic: false,
        detectedType: 'Satellite Scene',
        errorMessage: 'Satellite authenticity check unavailable.',
      });
      setErrorMsg(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    if (validationResult && !validationResult.isValid) {
      setErrorMsg('Cannot upload non-satellite imagery. Please submit a valid Earth observation or aerial remote-sensing scene.');
      return;
    }

    setUploading(true);
    setProgress(20);
    setErrorMsg(null);

    try {
      // Downscale oversized smartphone photos to prevent mobile browser memory/payload limits
      const base64Data = await new Promise<string>((resolve, reject) => {
        const isTiff = selectedFile.name.toLowerCase().endsWith('.tif') || selectedFile.name.toLowerCase().endsWith('.tiff');
        if (isTiff || selectedFile.size < 2.5 * 1024 * 1024) {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const maxDim = 2048;
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(e.target?.result as string);
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const mime = selectedFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
            resolve(canvas.toDataURL(mime, 0.90));
          };
          img.onerror = () => resolve(e.target?.result as string);
          img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      setProgress(50);

      try {
        const uploaded = await imageService.uploadImage({
          fileName: selectedFile.name,
          fileData: base64Data,
          mimetype: selectedFile.type || 'image/jpeg',
          projectId: selectedProject || null,
          source,
        });

        setProgress(100);
        setTimeout(() => {
          setUploading(false);
          onSuccess?.(uploaded);
        }, 400);
      } catch (err: any) {
        setUploading(false);
        let rawMsg = err.response?.data?.error?.message || err.response?.data?.error || err.message || 'Image upload failed. Please submit a valid satellite image.';
        if (
          typeof rawMsg === 'string' &&
          (rawMsg.includes('Unexpected token') ||
            rawMsg.toLowerCase().includes('<!doctype') ||
            rawMsg.toLowerCase().includes('<html') ||
            rawMsg.includes('is not valid JSON') ||
            rawMsg.includes('SERVER_HTML_FALLBACK'))
        ) {
          rawMsg = 'Satellite validation service returned an invalid response. Proceeding with local offline ingestion.';
        }
        setErrorMsg(rawMsg);
      }
    } catch (err: any) {
      setUploading(false);
      let rawMsg = err.message || 'Image upload failed. Please submit a valid satellite image.';
      if (
        typeof rawMsg === 'string' &&
        (rawMsg.includes('Unexpected token') ||
          rawMsg.toLowerCase().includes('<!doctype') ||
          rawMsg.toLowerCase().includes('<html') ||
          rawMsg.includes('is not valid JSON') ||
          rawMsg.includes('SERVER_HTML_FALLBACK'))
      ) {
        rawMsg = 'Satellite validation service returned an invalid response. Proceeding with local offline ingestion.';
      }
      setErrorMsg(rawMsg);
    }
  };

  return (
    <div className="rounded-xl border border-[#eeddd3] bg-white p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-[#eeddd3] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-[#FD1843]/10 p-2 text-[#FD1843] border border-[#FD1843]/20">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Ingest Satellite Scene</h3>
            <p className="text-xs text-slate-500">Upload GeoTIFF, GeoJPEG, or optical multispectral satellite tiles</p>
          </div>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-slate-400 hover:bg-[#FD1843]/10 hover:text-[#FD1843] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {errorMsg && (
        <div id="satellite-upload-alert" className="mt-4 flex items-start gap-2.5 rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block text-rose-900">
              {errorMsg.toLowerCase().includes('satellite') || errorMsg.toLowerCase().includes('invalid image')
                ? 'Satellite Authenticity Alert:'
                : 'Upload Notice:'}
            </span>
            <span className="block leading-relaxed">
              {(() => {
                if (
                  errorMsg.includes('Unexpected token') ||
                  errorMsg.toLowerCase().includes('<!doctype') ||
                  errorMsg.toLowerCase().includes('<html') ||
                  errorMsg.includes('is not valid JSON') ||
                  errorMsg.includes('SERVER_HTML_FALLBACK')
                ) {
                  return 'Satellite validation service returned an invalid response. Please re-upload a valid Earth observation scene.';
                }
                return errorMsg;
              })()}
            </span>
          </div>
        </div>
      )}

      {/* Drag & Drop Area */}
      {!selectedFile ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
            isDragOver
              ? 'border-[#FD1843] bg-[#FD1843]/10'
              : 'border-[#eeddd3] bg-[#FFF9F4]/70 hover:border-[#FD1843]/50 hover:bg-[#FFF9F4]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.tif,.tiff"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <div className="rounded-full bg-white p-3.5 text-[#FD1843] mb-3 border border-[#eeddd3] shadow-xs">
            <Satellite className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-800">
            Drag & drop satellite scene here, or <span className="text-[#FD1843] underline font-semibold">browse files</span>
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            Supports GeoTIFF (.tif, .tiff), PNG, JPEG up to 50MB (Sentinel-2, Landsat-8/9, PlanetScope, Drone Orthos)
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span>Only genuine satellite/aerial Earth observation imagery is accepted.</span>
          </div>
        </div>
      ) : (
        /* Selected File Card & Preview */
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-4 rounded-xl border border-[#eeddd3] bg-[#FFF9F4] p-4">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Upload preview"
                className="w-16 h-16 rounded-lg object-cover border border-[#eeddd3] shrink-0"
                onError={() => setPreviewUrl(null)}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono font-semibold text-slate-900 truncate">{selectedFile.name}</p>
                {(validationResult?.status === 'VALID' || (validationResult?.isValid && !validationResult?.status)) && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Earth Obs Scene
                  </span>
                )}
                {validationResult?.status === 'INVALID' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                    <ShieldAlert className="w-3 h-3 text-rose-600" /> Invalid Subject
                  </span>
                )}
                {validationResult?.status === 'UNAVAILABLE' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200" title="Satellite authenticity verification service unavailable">
                    <AlertCircle className="w-3 h-3 text-amber-600" /> Authenticity Check Unavailable
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'image/geotiff'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl(null);
                setValidationResult(null);
                setErrorMsg(null);
              }}
              className="text-xs font-mono text-slate-500 hover:text-[#FD1843] p-1.5 rounded-lg hover:bg-white transition-colors"
            >
              Change
            </button>
          </div>

          {/* Project & Metadata Controls */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5 font-mono">
                Assign to Project (Optional)
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full rounded-lg border border-[#eeddd3] bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#FD1843] focus:outline-none"
              >
                <option value="">No Project Assigned (Global Catalog)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5 font-mono">
                Source Provider / Mission
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-lg border border-[#eeddd3] bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#FD1843] focus:outline-none"
              >
                <option value="Copernicus Sentinel-2A">Copernicus Sentinel-2A (10m)</option>
                <option value="Copernicus Sentinel-2B">Copernicus Sentinel-2B (10m)</option>
                <option value="USGS Landsat-9 OLI-2 (30m)">USGS Landsat-9 OLI-2 (30m)</option>
                <option value="ISRO Resourcesat-2A LISS-4">ISRO Resourcesat-2A LISS-4 (5.8m)</option>
                <option value="Commercial High-Res Ortho">Commercial High-Res Ortho (&lt;3m)</option>
                <option value="Drone Aerial Survey">Drone Aerial Survey Orthomosaic</option>
              </select>
            </div>
          </div>

          {/* Upload Progress Bar */}
          {uploading && (
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs font-mono text-slate-500">
                <span>Auditing scene and ingesting spatial bounds...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#FD1843] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={uploading}
                className="px-4 py-2 rounded-lg border border-[#eeddd3] bg-white text-xs font-medium text-slate-700 hover:bg-[#FFF9F4] transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || isValidating || (validationResult !== null && !validationResult.isValid)}
              className="px-5 py-2 rounded-lg bg-[#FD1843] text-xs font-semibold text-white hover:bg-[#e01239] transition-colors shadow-lg shadow-[#FD1843]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              title={validationResult && !validationResult.isValid ? (validationResult.reason || validationResult.errorMessage || 'This file does not look like satellite imagery') : undefined}
            >
              {uploading
                ? 'Processing Scene...'
                : isValidating
                ? 'Auditing Authenticity...'
                : validationResult && !validationResult.isValid
                ? 'Invalid Satellite Image'
                : 'Upload & Catalog Scene'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
