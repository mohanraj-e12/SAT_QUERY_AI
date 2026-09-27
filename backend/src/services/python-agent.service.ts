import { spawn } from 'child_process';
import { existsSync } from 'node:fs';
import path from 'path';

export interface PythonAgentQueryPayload {
  query: string;
  primary_image: any;
  secondary_image?: any;
  input_mode?: 'SINGLE' | 'CROSS_MODAL_PAIR' | 'BITEMPORAL_PAIR' | 'AUTO';
  parameters?: Record<string, any>;
}

export class PythonAgentService {
  private bridgeScriptPath: string;

  constructor() {
    this.bridgeScriptPath = path.resolve(process.cwd(), 'backend/python/bridge.py');
  }

  /**
   * Invokes Python Agentic Orchestrator via CLI Bridge
   */
  public async executeBridge(action: string, data: Record<string, any> = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const payload = { action, ...data };
      const rootDir = process.cwd();
      const pythonPath = `${rootDir}:${path.resolve(rootDir, 'backend')}:${path.resolve(rootDir, 'backend/python')}:${process.env.PYTHONPATH || ''}`;
      const venvPython = path.resolve(
        rootDir,
        '.venv',
        process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
      );
      const pythonExecutable = process.env.PYTHON_PATH ||
        (existsSync(venvPython) ? venvPython : (process.platform === 'win32' ? 'python' : 'python3'));
      const pythonProcess = spawn(pythonExecutable, [this.bridgeScriptPath], {
        cwd: rootDir,
        env: { ...process.env, PYTHONPATH: pythonPath },
      });

      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      pythonProcess.stderr.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`[PythonAgentService] Python exited with code ${code}:`, stderrData);
          reject(new Error(`Python Agent execution failed: ${stderrData || 'Exit code ' + code}`));
          return;
        }

        try {
          const parsed = JSON.parse(stdoutData.trim());
          if (parsed.success) {
            resolve(parsed.data);
          } else {
            reject(new Error(parsed.error || 'Python execution error'));
          }
        } catch (err: any) {
          console.error('[PythonAgentService] JSON Parse Error:', stdoutData);
          reject(new Error(`Failed to parse Python agent output: ${err.message}`));
        }
      });

      // Write payload to stdin and close stream
      pythonProcess.stdin.write(JSON.stringify(payload));
      pythonProcess.stdin.end();
    });
  }

  public async query(payload: PythonAgentQueryPayload): Promise<any> {
    return this.executeBridge('query', payload);
  }

  public async getRegistry(): Promise<any> {
    return this.executeBridge('get_registry');
  }

  public async getEvaluationCriteria(): Promise<any> {
    return this.executeBridge('get_evaluation_criteria');
  }

  public async getBenchmarks(): Promise<any> {
    return this.executeBridge('get_benchmarks');
  }

  public async runEvaluation(benchmarkId?: string, options?: Record<string, any>): Promise<any> {
    return this.executeBridge('run_evaluation', { benchmark_id: benchmarkId || 'all', options });
  }

  public async getDatasetInfo(): Promise<any> {
    return this.executeBridge('get_dataset_info');
  }

  public async trainBigEarthNet(epochs: number = 5, maxSamples: number = 2500): Promise<any> {
    return this.executeBridge('train_bigearthnet', { epochs, max_samples: maxSamples });
  }

  public async evaluateUploadedImage(image: Record<string, any>, query?: string): Promise<any> {
    return this.executeBridge('evaluate_uploaded_image', { image, query: query || '' });
  }

  public async evaluateWithDLEngine(image: Record<string, any>, query?: string, spectralStats?: Record<string, any>): Promise<any> {
    return this.executeBridge('evaluate_with_dl_engine', { image, query: query || '', spectral_stats: spectralStats || {} });
  }

  public async getVrsBenchInfo(): Promise<any> {
    return this.executeBridge('vrsbench_info');
  }

  public async getVrsBenchSample(sampleIndex: number = 0): Promise<any> {
    return this.executeBridge('vrsbench_sample', { sample_index: sampleIndex });
  }

  public async getVrsBenchStatus(): Promise<any> {
    return this.executeBridge('vrsbench_status');
  }

  public async startVrsBenchTraining(maxSamples: number = 100, epochs: number = 1, learningRate: number = 0.001): Promise<any> {
    return this.executeBridge('vrsbench_train_start', { max_samples: maxSamples, epochs, learning_rate: learningRate });
  }

  public async stopVrsBenchTraining(): Promise<any> {
    return this.executeBridge('vrsbench_train_stop');
  }

  public async getVrsBenchTrainingStatus(): Promise<any> {
    return this.executeBridge('vrsbench_train_status');
  }

  public async evaluateVrsBenchModel(numSamples: number = 10): Promise<any> {
    return this.executeBridge('vrsbench_evaluate', { num_samples: numSamples });
  }

  public async analyzeInference(image: any, question: string, checkpoint?: string): Promise<any> {
    return this.executeBridge('inference_analyze', { image, question, checkpoint });
  }

  public async getHardwareInfo(): Promise<any> {
    return this.executeBridge('hardware_info');
  }

  public async queryFastApi(payload: { query: string; image_id?: string; image_data?: string; imageBase64?: string }): Promise<any> {
    return this.executeBridge('fastapi_query', payload);
  }

  public async uploadFastApi(payload: { fileData: string; fileName: string }): Promise<any> {
    return this.executeBridge('fastapi_upload', payload);
  }

  public async segmentFastApi(payload: { task: string; image_id?: string; image_data?: string }): Promise<any> {
    return this.executeBridge('fastapi_segment', payload);
  }

  public async classifyFastApi(payload: { image_id?: string; image_data?: string }): Promise<any> {
    return this.executeBridge('fastapi_classify', payload);
  }

  public async detectFastApi(payload: { target?: string; image_id?: string; image_data?: string }): Promise<any> {
    return this.executeBridge('fastapi_detect', payload);
  }
}

export const pythonAgentService = new PythonAgentService();
