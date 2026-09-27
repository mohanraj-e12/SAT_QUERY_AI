import { inMemoryStore } from '../database/store.js';
import { getSupabaseClient, isSupabaseConnected } from '../database/supabase.client.js';
import PDFDocument from 'pdfkit';

export interface AnalysisReport {
  reportId: string;
  generatedAt: string;
  branding: {
    system: string;
    title: string;
    version: string;
    developer: string;
    organization: string;
  };
  session: {
    sessionId: string;
    query: string;
    analysisType: string;
    confidence?: number;
    createdAt: string;
  };
  image: {
    id: string;
    satellite: string;
    sensor?: string;
    modality?: string;
    resolutionMeters?: number;
    crs?: string;
    acquisitionDate?: string;
    fileName?: string;
  };
  findings: {
    summary: string;
    detectionsCount: number;
    detections: Array<{
      id: string;
      label: string;
      category: string;
      confidence?: number;
      box2d?: [number, number, number, number];
      areaSqM?: number;
      modalityEvidence?: string;
    }>;
    statistics: Record<string, any>;
    recommendations: string[];
    quantification?: Record<string, any>;
    spectralIndices?: Record<string, any>;
    keyTakeaways?: string[];
    imageAnalysis?: Record<string, any>;
  };
  executionSummary: {
    selectedTask: string;
    agentsExecuted?: string[];
    modelsExecuted: string[];
    toolsExecuted: string[];
    parametersApplied?: Record<string, any>;
    coRegistrationStatus?: string;
    totalLatencyMs?: number;
    traceSteps: Array<{
      step: number;
      name: string;
      action: string;
      durationMs?: number;
    }>;
  };
  evaluationCompliance: {
    benchmarkProtocol: string;
    isroSacCompatible: boolean;
    auditableTraceCompliant: boolean;
  };
}

export class ReportService {
  public async generateReport(sessionId: string): Promise<AnalysisReport | null> {
    let session = inMemoryStore.sessions.get(sessionId);

    if (!session && isSupabaseConnected()) {
      const client = getSupabaseClient();
      if (client) {
        const { data } = await client.from('analysis_sessions').select('*').eq('id', sessionId).single();
        if (data) session = data as any;
      }
    }

    if (!session) return null;

    let image = inMemoryStore.images.get(session.image_id);
    if (!image && isSupabaseConnected()) {
      const client = getSupabaseClient();
      if (client) {
        const { data } = await client.from('satellite_images').select('*').eq('id', session.image_id).single();
        if (data) image = data as any;
      }
    }

    const res: any = session.result || {};
    const trace = res.executionTrace || [];
    const detections = (res.detections || []).map((d: any) => ({
      id: d.id,
      label: d.label,
      category: d.category,
      confidence: d.confidence,
      ...(Array.isArray(d.box_2d) && d.box_2d.length === 4 ? { box2d: d.box_2d } : {}),
      areaSqM: d.area_sq_m,
      modalityEvidence: d.modality_evidence,
    }));

    const report: AnalysisReport = {
      reportId: `REP-${session.id.substring(0, 8).toUpperCase()}`,
      generatedAt: new Date().toISOString(),
      branding: {
        system: 'SatQuery AI',
        title: 'Interactive Vision-Language Assistant for Multimodal Remote-Sensing Image Analysis',
        version: '2.5.0-Enterprise',
        developer: 'Mohanraj E',
        organization: 'Smart India Hackathon (SIH) Remote-Sensing Intelligence Division',
      },
      session: {
        sessionId: session.id,
        query: session.query,
        analysisType: session.analysis_type,
        ...(typeof session.confidence === 'number' ? { confidence: session.confidence } : {}),
        createdAt: session.created_at,
      },
      image: {
        id: image?.id || session.image_id,
        satellite: image?.satellite || 'User-provided imagery',
        sensor: image?.sensor || image?.metadata?.sensor || undefined,
        modality: image?.metadata?.modality || res.imageAnalysis?.image_type,
        resolutionMeters: image?.resolution_meters ?? undefined,
        crs: image?.metadata?.crs || res.imageAnalysis?.georeferencing?.bounds?.crs,
        acquisitionDate: image?.acquisition_date || undefined,
        fileName: image?.file_name || undefined,
      },
      findings: {
        summary: res.summary || 'No analysis summary was stored for this session.',
        detectionsCount: detections.length,
        detections,
        statistics: res.statistics || {},
        recommendations: res.recommendations || [],
        quantification: res.crossModalMetrics?.quantification || res.changeMetrics,
        spectralIndices: res.spectralIndices,
        keyTakeaways: res.keyTakeaways || [],
        imageAnalysis: res.imageAnalysis,
      },
      executionSummary: {
        selectedTask: res.auditableSummary?.selected_task || session.analysis_type,
        agentsExecuted: res.agentsExecuted || res.auditableSummary?.agents_executed || [],
        modelsExecuted: res.modelsExecuted || res.auditableSummary?.specialist_models || [],
        toolsExecuted: res.toolsExecuted || [],
        parametersApplied: res.auditableSummary?.permitted_parameters,
        coRegistrationStatus: res.auditableSummary?.input_verification?.co_registration_status || undefined,
        totalLatencyMs: res.totalLatencyMs || res.auditableSummary?.total_processing_time_ms || undefined,
        traceSteps: trace.map((t: any) => ({
          step: t.step,
          name: t.name,
          action: t.action,
          durationMs: t.duration_ms,
        })),
      },
      evaluationCompliance: {
        benchmarkProtocol: 'Not assessed',
        isroSacCompatible: false,
        auditableTraceCompliant: trace.length > 0,
      },
    };

    return report;
  }

  public generateHtmlReport(report: AnalysisReport): string {
    const escapeHtml = (value: unknown): string => String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const formatLabel = (value: string): string => value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    const formatValue = (value: unknown): string => (
      typeof value === 'number' ? value.toFixed(3).replace(/\.?0+$/, '') : String(value)
    );
    const measuredStatistics = Object.entries(report.findings.statistics)
      .filter(([, value]) => ['number', 'string'].includes(typeof value))
      .map(([key, value]) => `
        <tr style="border-bottom: 1px solid #1e293b;">
          <td style="padding: 8px; color: #cbd5e1;">${escapeHtml(formatLabel(key))}</td>
          <td style="padding: 8px; color: #34d399;">${escapeHtml(formatValue(value))}${key.toLowerCase().includes('percentage') ? '%' : ''}</td>
        </tr>`)
      .join('');
    const analysisIndices = report.findings.imageAnalysis?.indices || report.findings.spectralIndices || {};
    const indexRows = Object.entries(analysisIndices).flatMap(([name, values]) => {
      if (!values || typeof values !== 'object') return [];
      const stats = values as Record<string, unknown>;
      return ['mean', 'median', 'minimum', 'maximum'].flatMap((statistic) => {
        const value = stats[statistic];
        return typeof value === 'number'
          ? [`<tr style="border-bottom: 1px solid #1e293b;"><td style="padding: 8px; color: #cbd5e1;">${escapeHtml(formatLabel(name))} ${escapeHtml(formatLabel(statistic))}</td><td style="padding: 8px; color: #34d399;">${value.toFixed(3)}</td></tr>`]
          : []
      });
    }).join('');
    const traceRows = report.executionSummary.traceSteps
      .map(
        (t) => `
      <tr style="border-bottom: 1px solid #1e293b;">
        <td style="padding: 10px; font-weight: 600; color: #38bdf8;">Step ${t.step}: ${escapeHtml(t.name)}</td>
        <td style="padding: 10px; color: #cbd5e1;">${escapeHtml(t.action)}</td>
        <td style="padding: 10px; text-align: right; color: #94a3b8;">${t.durationMs ? t.durationMs + ' ms' : 'N/A'}</td>
      </tr>
    `
      )
      .join('');

    const detectionRows = report.findings.detections
      .map(
        (d) => `
      <tr style="border-bottom: 1px solid #1e293b;">
        <td style="padding: 8px; font-weight: 500; color: #f8fafc;">${escapeHtml(d.label)}</td>
        <td style="padding: 8px; color: #a855f7;">${escapeHtml(d.category)}</td>
        <td style="padding: 8px; color: #34d399;">${typeof d.confidence === 'number' ? `${Math.round(d.confidence * 100)}%` : 'Not calibrated'}</td>
        <td style="padding: 8px; color: #94a3b8; font-size: 12px;">${escapeHtml(d.modalityEvidence || 'Image-derived region mask')}</td>
      </tr>
    `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${report.reportId} - SatQuery AI Analysis Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f1f5f9; padding: 40px; margin: 0; }
          .container { max-width: 900px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 32px; border: 1px solid #334155; }
          .header { display: flex; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 24px; margin-bottom: 24px; }
          .title { font-size: 24px; font-weight: 700; color: #38bdf8; margin: 0 0 6px 0; }
          .subtitle { font-size: 13px; color: #94a3b8; margin: 0; }
          .badge { display: inline-block; background: #0284c7; color: white; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
          .section { margin-bottom: 28px; }
          .section-title { font-size: 16px; font-weight: 600; color: #e2e8f0; border-bottom: 1px solid #334155; padding-bottom: 8px; margin-bottom: 12px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
          .card { background: #0f172a; padding: 14px; border-radius: 8px; border: 1px solid #1e293b; }
          .label { font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
          .value { font-size: 14px; font-weight: 500; color: #f8fafc; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
          th { text-align: left; padding: 10px; background: #0f172a; color: #94a3b8; font-weight: 600; }
          .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #334155; font-size: 12px; color: #64748b; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>
              <h1 class="title">${escapeHtml(report.branding.system)}</h1>
                <p class="subtitle">Image-derived analysis report</p>
            </div>
            <div style="text-align: right;">
              <span class="badge">${escapeHtml(report.reportId)}</span>
              <p style="font-size: 12px; color: #94a3b8; margin: 6px 0 0 0;">${new Date(report.generatedAt).toUTCString()}</p>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Query & Operational Scope</div>
            <div class="card" style="margin-bottom: 12px;">
              <div class="label">Natural-Language Query</div>
              <div class="value" style="font-size: 16px; color: #38bdf8;">"${escapeHtml(report.session.query)}"</div>
            </div>
            <div class="grid">
              <div class="card">
                <div class="label">Task Classified</div>
                <div class="value">${escapeHtml(report.session.analysisType)}</div>
              </div>
              ${typeof report.session.confidence === 'number' ? `<div class="card">
                <div class="label">Confidence Score</div>
                <div class="value" style="color: #34d399;">${Math.round(report.session.confidence * 100)}%</div>
              </div>` : ''}
            </div>
          </div>

          <div class="section">
            <div class="section-title">Remote-Sensing Input Validation</div>
            <div class="grid">
              <div class="card">
                <div class="label">Mission / Satellite</div>
                <div class="value">${escapeHtml(report.image.satellite)}${report.image.sensor ? ` (${escapeHtml(report.image.sensor)})` : ''}</div>
              </div>
              <div class="card">
                <div class="label">Spatial Resolution & CRS</div>
                <div class="value">${report.image.resolutionMeters !== undefined ? `${report.image.resolutionMeters}m` : 'Resolution unavailable'}${report.image.crs ? ` / ${escapeHtml(report.image.crs)}` : ''}</div>
              </div>
              <div class="card">
                <div class="label">Modality</div>
                <div class="value">${escapeHtml(report.image.modality || 'Unavailable')}</div>
              </div>
              ${report.executionSummary.coRegistrationStatus ? `<div class="card">
                <div class="label">Co-Registration Status</div>
                <div class="value" style="color: #38bdf8;">${escapeHtml(report.executionSummary.coRegistrationStatus)}</div>
              </div>` : ''}
            </div>
          </div>

          <div class="section">
            <div class="section-title">Synthesized Finding & Interpretation</div>
            <div class="card" style="line-height: 1.6; font-size: 14px; color: #e2e8f0;">
              <div style="white-space: pre-wrap;">${escapeHtml(report.findings.summary)}</div>
            </div>
          </div>

          ${measuredStatistics || indexRows ? `<div class="section">
            <div class="section-title">Measured Results</div>
            <table><tbody>${measuredStatistics}${indexRows}</tbody></table>
          </div>` : ''}
          ${report.findings.imageAnalysis?.overlays?.land_cover ? `<div class="section">
            <div class="section-title">Image-Derived Land-Cover Overlay</div>
            <img src="${escapeHtml(report.findings.imageAnalysis.overlays.land_cover)}" alt="Image-derived land-cover analysis overlay" style="max-width: 100%; max-height: 480px; object-fit: contain; border-radius: 8px;" />
          </div>` : ''}

          ${
            report.findings.detections.length > 0
              ? `
          <div class="section">
            <div class="section-title">Visual Evidence & Spatial Grounding (${report.findings.detections.length} Targets)</div>
            <table>
              <thead>
                <tr>
                  <th>Target Description</th>
                  <th>Category</th>
                  <th>Confidence</th>
                  <th>Sensor Evidence</th>
                </tr>
              </thead>
              <tbody>
                ${detectionRows}
              </tbody>
            </table>
          </div>
          `
              : ''
          }

          <div class="section">
            <div class="section-title">Processing Trace</div>
            <table>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Action Performed</th>
                  <th style="text-align: right;">Latency</th>
                </tr>
              </thead>
              <tbody>
                ${traceRows}
              </tbody>
            </table>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">
              ${report.executionSummary.totalLatencyMs !== undefined ? `Processing time: ${report.executionSummary.totalLatencyMs} ms` : ''}
            </div>
          </div>

          <div class="footer">
            ${escapeHtml(report.reportId)} &bull; ${escapeHtml(report.image.fileName || 'Image file name unavailable')} &bull; ${report.image.acquisitionDate ? escapeHtml(report.image.acquisitionDate) : 'Acquisition date unavailable'}
          </div>
        </div>
      </body>
      </html>
    `;
  }

  public async generatePdfReport(report: AnalysisReport): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `${report.reportId} SatQuery AI Report` } });
      const chunks: Buffer[] = [];
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);

      const section = (title: string) => {
        document.moveDown(0.7);
        document.fontSize(13).fillColor('#FD1843').text(title);
        document.moveDown(0.25);
      };

      document.fontSize(22).fillColor('#FD1843').text('SatQuery AI');
      document.fontSize(11).fillColor('#64748b').text('Image-derived analysis report');
      document.fontSize(9).text(`${report.reportId} | ${new Date(report.generatedAt).toLocaleString()}`);
      section('User Question');
      document.fontSize(11).fillColor('#1e293b').text(report.session.query);
      section('Image');
      document.fontSize(10).fillColor('#1e293b')
        .text(`File: ${report.image.fileName || 'Unavailable'}`)
        .text(`Source: ${report.image.satellite}${report.image.sensor ? ` / ${report.image.sensor}` : ''}`)
        .text(`Image type: ${report.image.modality || 'Unavailable'}`)
        .text(`Acquisition date: ${report.image.acquisitionDate || 'Unavailable'}`)
        .text(`Resolution: ${report.image.resolutionMeters !== undefined ? `${report.image.resolutionMeters} m` : 'Unavailable'}`)
        .text(`CRS: ${report.image.crs || 'Georeferencing unavailable'}`);
      section('Analysis Result');
      document.fontSize(10).fillColor('#1e293b').text(report.findings.summary, { lineGap: 3 });

      const scalarStatistics = Object.entries(report.findings.statistics)
        .filter(([, value]) => typeof value === 'number' || typeof value === 'string');
      if (scalarStatistics.length > 0) {
        section('Measured Values');
        scalarStatistics.forEach(([key, value]) => {
          document.fontSize(9).fillColor('#1e293b')
            .text(`${key.replace(/([a-z])([A-Z])/g, '$1 $2')}: ${value}${key.toLowerCase().includes('percentage') ? '%' : ''}`);
        });
      }

      const indices = report.findings.imageAnalysis?.indices || report.findings.spectralIndices || {};
      const availableIndices = Object.entries(indices)
        .filter(([, values]) => values && typeof values === 'object');
      if (availableIndices.length > 0) {
        section('Spectral Indices');
        availableIndices.forEach(([name, values]) => {
          if (!values || typeof values !== 'object') return;
          const stats = values as Record<string, unknown>;
          const formattedStats = ['mean', 'median', 'minimum', 'maximum']
            .flatMap((key) => {
              const value = stats[key];
              return typeof value === 'number' ? [`${key}: ${value.toFixed(3)}`] : [];
            })
            .join(', ');
          if (formattedStats) document.fontSize(9).fillColor('#1e293b').text(`${name.toUpperCase()} — ${formattedStats}`);
        });
      }

      const overlayData = report.findings.imageAnalysis?.overlays?.land_cover;
      if (typeof overlayData === 'string') {
        const match = overlayData.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
        if (match) {
          section('Image-Derived Land-Cover Evidence');
          document.image(Buffer.from(match[1], 'base64'), { fit: [500, 350], align: 'center' });
        }
      }

      if (report.findings.detections.length > 0) {
        section('Measured Regions');
        report.findings.detections.forEach((detection) => {
          const bounds = detection.box2d
            ? `; image-relative envelope [${detection.box2d.map((value) => value.toFixed(3)).join(', ')}]`
            : '';
          document.fontSize(9).fillColor('#1e293b')
            .text(`${detection.label} (${detection.category})${bounds}`);
        });
      }
      document.end();
    });
  }
}

export const reportService = new ReportService();
