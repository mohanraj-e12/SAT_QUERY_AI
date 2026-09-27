import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Database, 
  Play, 
  Square, 
  Activity, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Cpu, 
  Layers, 
  BarChart3, 
  FileText,
  Sparkles,
  Zap,
  Check
} from 'lucide-react';
import { api } from '../services/api.js';

export const ModelLabPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vrsbench' | 'bigearthnet' | 'benchmarks'>('vrsbench');
  
  // VRSBench State
  const [vrsInfo, setVrsInfo] = useState<any>(null);
  const [loadingInfo, setLoadingInfo] = useState<boolean>(true);
  const [sampleIndex, setSampleIndex] = useState<number>(0);
  const [currentSample, setCurrentSample] = useState<any>(null);
  const [loadingSample, setLoadingSample] = useState<boolean>(false);
  
  // Training State
  const [trainStatus, setTrainStatus] = useState<any>(null);
  const [maxSamples, setMaxSamples] = useState<number>(10);
  const [epochs, setEpochs] = useState<number>(1);
  const [learningRate, setLearningRate] = useState<number>(0.001);
  const [isStartingTrain, setIsStartingTrain] = useState<boolean>(false);

  // Evaluation State
  const [evalResult, setEvalResult] = useState<any>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Hardware state
  const [hardwareInfo, setHardwareInfo] = useState<any>(null);

  useEffect(() => {
    loadVrsBenchData();
  }, []);

  const loadVrsBenchData = async () => {
    setLoadingInfo(true);
    try {
      const [infoRes, statusRes, hwRes] = await Promise.allSettled([
        api.get<any>('/api/dataset/vrsbench/info'),
        api.get<any>('/api/training/status'),
        api.get<any>('/api/hardware/info')
      ]);

      if (infoRes.status === 'fulfilled') setVrsInfo(infoRes.value);
      if (statusRes.status === 'fulfilled') setTrainStatus(statusRes.value);
      if (hwRes.status === 'fulfilled') setHardwareInfo(hwRes.value);

      // Load first sample
      loadSample(0);
    } catch (err) {
      console.error('Error loading VRSBench metadata:', err);
    } finally {
      setLoadingInfo(false);
    }
  };

  const loadSample = async (idx: number) => {
    setLoadingSample(true);
    try {
      const res = await api.get<any>(`/api/dataset/vrsbench/sample?index=${idx}`);
      if (res && res.success) {
        setCurrentSample(res.data);
      }
    } catch (err) {
      console.error('Error fetching sample:', err);
    } finally {
      setLoadingSample(false);
    }
  };

  const handleStartTraining = async () => {
    setIsStartingTrain(true);
    try {
      await api.post<any>('/api/training/start', {
        max_samples: maxSamples,
        epochs: epochs,
        learning_rate: learningRate
      });
      // Poll status
      pollTrainingStatus();
    } catch (err: any) {
      alert(`Failed to start training: ${err.message}`);
    } finally {
      setIsStartingTrain(false);
    }
  };

  const handleStopTraining = async () => {
    try {
      await api.post<any>('/api/training/stop', {});
      refreshStatus();
    } catch (err: any) {
      alert(`Failed to stop training: ${err.message}`);
    }
  };

  const refreshStatus = async () => {
    try {
      const statusRes = await api.get<any>('/api/training/status');
      setTrainStatus(statusRes);
    } catch (err) {
      console.error('Error refreshing status:', err);
    }
  };

  const pollTrainingStatus = () => {
    const interval = setInterval(async () => {
      try {
        const statusRes = await api.get<any>('/api/training/status');
        setTrainStatus(statusRes);
        if (statusRes.status !== 'running') {
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
      }
    }, 1500);
  };

  const handleRunEvaluation = async () => {
    setIsEvaluating(true);
    try {
      const res = await api.post<any>('/api/training/evaluate', { num_samples: 5 });
      setEvalResult(res);
    } catch (err: any) {
      alert(`Evaluation failed: ${err.message}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 border border-indigo-500/30 mb-2">
              <Sparkles className="h-3.5 w-3.5" /> VRSBench VLM Engine & Model Lab
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Multimodal Remote Sensing Model Lab</h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Real-time streaming, multimodal training, checkpoint management, and benchmark evaluation on the Hugging Face <code className="text-indigo-300 font-mono">xiang709/VRSBench</code> dataset.
            </p>
          </div>
          {hardwareInfo && (
            <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3 border border-white/10 backdrop-blur-sm text-xs">
              <Cpu className="h-5 w-5 text-indigo-400" />
              <div>
                <div className="font-semibold text-white">Compute Environment</div>
                <div className="text-slate-300">PyTorch {hardwareInfo.pytorch_version || '2.14'} • {hardwareInfo.device || 'CPU'}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('vrsbench')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'vrsbench'
              ? 'border-indigo-600 text-indigo-600 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Brain className="h-4 w-4" /> VRSBench VLM & Training
        </button>
        <button
          onClick={() => setActiveTab('bigearthnet')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'bigearthnet'
              ? 'border-indigo-600 text-indigo-600 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="h-4 w-4" /> BigEarthNet Classifier
        </button>
        <button
          onClick={() => setActiveTab('benchmarks')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'benchmarks'
              ? 'border-indigo-600 text-indigo-600 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="h-4 w-4" /> Benchmark Leaderboard
        </button>
      </div>

      {/* VRSBench Tab Content */}
      {activeTab === 'vrsbench' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Dataset Streamer & Sample Viewer */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Database className="h-4 w-4 text-indigo-600" /> Dataset Streamer
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Streaming
                </span>
              </div>

              {loadingInfo ? (
                <div className="py-8 text-center text-slate-500 text-sm">Loading dataset metadata...</div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="text-xs text-slate-500">Repository</div>
                    <div className="font-mono text-slate-800 font-medium">xiang709/VRSBench</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="text-xs text-slate-500">Split</div>
                      <div className="font-semibold text-slate-800">train (streaming)</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="text-xs text-slate-500">Config</div>
                      <div className="font-semibold text-slate-800">default</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sample Browser Controls */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-900">Explore Real Samples</span>
                  <button
                    onClick={() => {
                      const next = (sampleIndex + 1) % 20;
                      setSampleIndex(next);
                      loadSample(next);
                    }}
                    disabled={loadingSample}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingSample ? 'animate-spin' : ''}`} /> Next Sample
                  </button>
                </div>

                {loadingSample ? (
                  <div className="py-12 text-center text-slate-400 text-sm">Loading sample from Hub...</div>
                ) : currentSample ? (
                  <div className="space-y-3">
                    {currentSample.image && (
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-900">
                        <img 
                          src={currentSample.image} 
                          alt="VRSBench Scene" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs space-y-2">
                      <div>
                        <span className="font-semibold text-slate-700">Caption:</span> 
                        <p className="text-slate-600 mt-0.5">{currentSample.caption || 'No caption'}</p>
                      </div>
                      {currentSample.qa_pairs && currentSample.qa_pairs.length > 0 && (
                        <div>
                          <span className="font-semibold text-slate-700">Q&A Pair:</span>
                          <p className="text-indigo-600 font-medium mt-0.5">Q: {currentSample.qa_pairs[0].question}</p>
                          <p className="text-emerald-700 font-medium">A: {currentSample.qa_pairs[0].answer}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 text-center py-6">No sample loaded.</div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Training & Evaluation Hub */}
          <div className="lg:col-span-2 space-y-6">
            {/* Training Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Brain className="h-5 w-5 text-indigo-600" /> Multimodal Training Pipeline
                </h3>
                {trainStatus?.status === 'running' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span> Training Active
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Max Samples</label>
                  <input
                    type="number"
                    value={maxSamples}
                    onChange={(e) => setMaxSamples(parseInt(e.target.value) || 10)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Epochs</label>
                  <input
                    type="number"
                    value={epochs}
                    onChange={(e) => setEpochs(parseInt(e.target.value) || 1)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Learning Rate</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={learningRate}
                    onChange={(e) => setLearningRate(parseFloat(e.target.value) || 0.001)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                {trainStatus?.status === 'running' ? (
                  <button
                    onClick={handleStopTraining}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
                  >
                    <Square className="h-4 w-4" /> Stop Training
                  </button>
                ) : (
                  <button
                    onClick={handleStartTraining}
                    disabled={isStartingTrain}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
                  >
                    <Play className="h-4 w-4" /> Start VRSBench Training
                  </button>
                )}
                <button
                  onClick={refreshStatus}
                  className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  title="Refresh Status"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              {/* Status Telemetry */}
              {trainStatus && (
                <div className="mt-6 bg-slate-50 rounded-xl p-4 border border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-xs text-slate-500">Status</div>
                    <div className="font-semibold text-slate-800 capitalize mt-0.5">{trainStatus.status}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Epoch</div>
                    <div className="font-semibold text-slate-800 mt-0.5">{trainStatus.epoch} / {trainStatus.total_epochs}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Loss</div>
                    <div className="font-semibold text-indigo-600 mt-0.5">{trainStatus.loss ?? 0.0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Accuracy</div>
                    <div className="font-semibold text-emerald-600 mt-0.5">{trainStatus.accuracy ?? 0.0}%</div>
                  </div>
                </div>
              )}
            </div>

            {/* Evaluation Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-indigo-600" /> Model Evaluation & Checkpointing
                </h3>
                <button
                  onClick={handleRunEvaluation}
                  disabled={isEvaluating}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-4 py-2 rounded-xl transition-colors flex items-center gap-2 shadow-sm"
                >
                  {isEvaluating && <RefreshCw className="h-3 w-3 animate-spin" />}
                  Run Evaluation
                </button>
              </div>

              {trainStatus?.checkpoint_exists && (
                <div className="mb-4 inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl text-xs border border-emerald-200">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span>Checkpoint saved at <code className="font-mono">{trainStatus.checkpoint_path}</code></span>
                </div>
              )}

              {evalResult ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                    <div>
                      <div className="text-xs text-slate-500">Accuracy</div>
                      <div className="text-lg font-bold text-emerald-600">{evalResult.accuracy}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">BLEU-4</div>
                      <div className="text-lg font-bold text-indigo-600">{evalResult.bleu_4}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">CIDEr</div>
                      <div className="text-lg font-bold text-slate-800">{evalResult.cider}</div>
                    </div>
                  </div>

                  {evalResult.details && evalResult.details.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-600">Sample Predictions</div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {evalResult.details.map((d: any, idx: number) => (
                          <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                            <div className="font-medium text-slate-800">Q: {d.question}</div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Ground Truth: <strong className="text-slate-900">{d.ground_truth}</strong></span>
                              <span className={`px-2 py-0.5 rounded font-medium ${d.correct ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                Pred: {d.prediction}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-500 py-6 text-center">
                  Click 'Run Evaluation' to test model performance against streaming VRSBench ground truth.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BigEarthNet Tab Content */}
      {activeTab === 'bigearthnet' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
          <Layers className="h-12 w-12 text-indigo-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">BigEarthNet Multispectral Classifier</h3>
          <p className="text-slate-600 text-sm max-w-lg mx-auto">
            BigEarthNet-S2 consists of 590,326 Sentinel-2 patches with multi-label land-cover annotations. Use the Assistant or Satellite inspector to run multispectral inference.
          </p>
        </div>
      )}

      {/* Benchmarks Tab Content */}
      {activeTab === 'benchmarks' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
          <BarChart3 className="h-12 w-12 text-indigo-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">Remote Sensing Benchmark Leaderboard</h3>
          <p className="text-slate-600 text-sm max-w-lg mx-auto">
            Comparing SatQuery AI VLM architectures against standard benchmarks (RSVQA, CDVQA, and BigEarthNet).
          </p>
        </div>
      )}
    </div>
  );
};
