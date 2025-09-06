/**
 * Script Execution Engine
 * Handles secure Docker-based script execution with resource monitoring and sandboxing
 */

import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { Script } from '../../models/Script';
import { ScriptExecution, ScriptExecutionStatus, ScriptExecutionPriority } from '../../models/ScriptExecution';
import { DEFAULT_SCRIPT_CONFIG, DOCKER_IMAGES, MONITORING_CONFIG } from './config';
import {
  ScriptError,
  ValidationError,
  ResourceError,
  sanitizeParameters,
  generateExecutionId,
  validateResourceLimits,
  ensureDirectory,
  ERROR_CODES
} from './utils';

export interface ExecutionOptions {
  parameters?: Record<string, any>;
  environment?: Record<string, string>;
  resourceLimits?: {
    memory?: string;
    cpu?: string;
    disk?: string;
  };
  networkAccess?: boolean;
  timeout?: number;
  priority?: ScriptExecutionPriority;
  workingDirectory?: string;
}

export interface ExecutionResult {
  executionId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  logs: string;
  duration: number;
  resourceUsage: {
    maxMemoryMB: number;
    maxCpuPercent: number;
    diskUsedMB: number;
    networkBytesIn: number;
    networkBytesOut: number;
  };
  artifacts: string[];
  error?: string;
}

export interface ExecutionProgress {
  executionId: string;
  status: ScriptExecutionStatus;
  progress: number; // 0-100
  logs: string;
  resourceUsage?: {
    memoryMB: number;
    cpuPercent: number;
    diskUsedMB: number;
  };
  currentStep?: string;
  estimatedTimeRemaining?: number;
}

export class ExecutionEngine extends EventEmitter {
  private config = DEFAULT_SCRIPT_CONFIG;
  private runningExecutions = new Map<string, {
    execution: ScriptExecution;
    process: ChildProcess;
    containerId: string;
    startTime: Date;
    resourceMonitor?: NodeJS.Timeout;
  }>();

  constructor() {
    super();
    this.initializeEngine();
  }

  /**
   * Initialize the execution engine
   */
  private async initializeEngine(): Promise<void> {
    try {
      // Ensure storage directories exist
      await ensureDirectory(this.config.scriptsStoragePath);
      await ensureDirectory(this.config.logsStoragePath);
      await ensureDirectory(this.config.artifactsStoragePath);
      await ensureDirectory(this.config.tempStoragePath);

      // Start cleanup interval
      setInterval(() => {
        this.cleanupStaleExecutions();
      }, MONITORING_CONFIG.CLEANUP_INTERVAL);

      this.emit('engine-initialized');
    } catch (error) {
      throw new ScriptError(
        `Failed to initialize execution engine: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { error: error as Error }
      );
    }
  }

  /**
   * Execute a script
   */
  async executeScript(
    scriptId: string,
    executorId: string,
    options: ExecutionOptions = {}
  ): Promise<string> {
    try {
      // Validate concurrent execution limit
      if (this.runningExecutions.size >= this.config.maxConcurrentExecutions) {
        throw new ResourceError(
          `Maximum concurrent executions reached: ${this.config.maxConcurrentExecutions}`
        );
      }

      // Get script
      const script = await Script.findByPk(scriptId, { include: ['parameters'] });
      if (!script) {
        throw new ValidationError(`Script not found: ${scriptId}`);
      }

      if (!script.isExecutable) {
        throw new ValidationError(`Script is not executable: ${script.name}`);
      }

      // Validate resource limits
      if (options.resourceLimits) {
        validateResourceLimits(options.resourceLimits);
      }

      // Sanitize parameters
      const sanitizedParameters = options.parameters 
        ? sanitizeParameters(options.parameters)
        : {};

      // Create execution record
      const execution = await ScriptExecution.create({
        scriptId,
        executorId,
        priority: options.priority || ScriptExecutionPriority.NORMAL,
        parameters: sanitizedParameters,
        environment: options.environment,
        workingDirectory: options.workingDirectory,
        maxRetries: 3
      });

      // Generate unique execution ID
      const executionId = generateExecutionId();

      // Start execution
      await this.startExecution(execution, script, options, executionId);

      return execution.id;
    } catch (error) {
      if (error instanceof ScriptError) {
        throw error;
      }
      throw new ScriptError(
        `Failed to execute script: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { scriptId, error: error as Error }
      );
    }
  }

  /**
   * Start script execution in Docker container
   */
  private async startExecution(
    execution: ScriptExecution,
    script: Script,
    options: ExecutionOptions,
    executionId: string
  ): Promise<void> {
    try {
      // Update execution status
      await execution.update({ status: ScriptExecutionStatus.QUEUED });

      // Get effective resource limits
      const resourceLimits = {
        memory: options.resourceLimits?.memory || script.effectiveResourceLimits.maxMemory + 'm',
        cpu: options.resourceLimits?.cpu || script.effectiveResourceLimits.maxCpu.toString(),
        disk: options.resourceLimits?.disk || script.effectiveResourceLimits.maxDisk + 'm'
      };

      // Create execution workspace
      const workspaceDir = path.join(this.config.tempStoragePath, executionId);
      await ensureDirectory(workspaceDir);

      const logsDir = path.join(this.config.logsStoragePath, executionId);
      await ensureDirectory(logsDir);

      const outputDir = path.join(this.config.artifactsStoragePath, executionId);
      await ensureDirectory(outputDir);

      // Copy script to workspace
      const scriptPath = path.join(this.config.scriptsStoragePath, script.filePath);
      const workspaceScriptPath = path.join(workspaceDir, 'script.' + script.language);
      await fs.copyFile(scriptPath, workspaceScriptPath);

      // Prepare Docker command
      const dockerImage = DOCKER_IMAGES[script.language as keyof typeof DOCKER_IMAGES] || DOCKER_IMAGES.python;
      const containerId = `script-${executionId}`;

      const dockerArgs = [
        'run',
        '--rm',
        '--name', containerId,
        // Resource limits
        '--memory', resourceLimits.memory,
        '--cpus', resourceLimits.cpu,
        '--storage-opt', `size=${resourceLimits.disk}`,
        // Security settings
        '--security-opt', 'no-new-privileges:true',
        '--cap-drop', 'ALL',
        '--cap-add', 'DAC_OVERRIDE',
        '--user', '1000:1000',
        '--read-only=false',
        '--pids-limit', '100',
        // Volume mounts
        '--volume', `${workspaceDir}:/app/workspace`,
        '--volume', `${logsDir}:/app/logs`,
        '--volume', `${outputDir}:/app/output`,
        // Environment variables
        '--env', `SCRIPT_FILE=/app/workspace/script.${script.language}`,
        '--env', `SCRIPT_TIMEOUT=${options.timeout || script.maxExecutionTime}`,
        '--env', `SCRIPT_MEMORY=${resourceLimits.memory.replace('m', '')}`,
        '--env', `SCRIPT_CPU=${resourceLimits.cpu}`,
        '--env', `LOG_FILE=/app/logs/execution.log`
      ];

      // Add custom environment variables
      if (options.environment) {
        for (const [key, value] of Object.entries(options.environment)) {
          dockerArgs.push('--env', `${key}=${value}`);
        }
      }

      // Add parameters as environment variables
      if (execution.parameters) {
        for (const [key, value] of Object.entries(execution.parameters)) {
          dockerArgs.push('--env', `PARAM_${key.toUpperCase()}=${value}`);
        }
      }

      // Network configuration
      if (options.networkAccess) {
        dockerArgs.push('--network', 'bridge');
        dockerArgs.push('--dns', '8.8.8.8');
      } else {
        dockerArgs.push('--network', 'none');
      }

      // Add Docker image and command
      dockerArgs.push(dockerImage);
      dockerArgs.push('/usr/local/bin/security-wrapper.sh');

      // Start Docker container
      const dockerProcess = spawn('docker', dockerArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          DOCKER_CLI_EXPERIMENTAL: 'enabled'
        }
      });

      // Update execution record
      await execution.start(containerId, dockerProcess.pid);

      // Store running execution
      this.runningExecutions.set(execution.id, {
        execution,
        process: dockerProcess,
        containerId,
        startTime: new Date()
      });

      // Set up process handlers
      this.setupExecutionHandlers(execution, dockerProcess, executionId, workspaceDir, outputDir);

      // Start resource monitoring
      this.startResourceMonitoring(execution.id);

      this.emit('execution-started', {
        executionId: execution.id,
        scriptId: script.id,
        containerId
      });

    } catch (error) {
      await execution.fail(
        `Failed to start execution: ${(error as Error).message}`,
        undefined,
        -1
      );
      throw error;
    }
  }

  /**
   * Set up execution process handlers
   */
  private setupExecutionHandlers(
    execution: ScriptExecution,
    process: ChildProcess,
    executionId: string,
    workspaceDir: string,
    outputDir: string
  ): void {
    let stdout = '';
    let stderr = '';

    // Handle stdout
    if (process.stdout) {
      process.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        this.emit('execution-progress', {
          executionId: execution.id,
          status: execution.status,
          logs: chunk
        } as ExecutionProgress);
      });
    }

    // Handle stderr
    if (process.stderr) {
      process.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        this.emit('execution-progress', {
          executionId: execution.id,
          status: execution.status,
          logs: chunk
        } as ExecutionProgress);
      });
    }

    // Handle process exit
    process.on('exit', async (code, signal) => {
      try {
        const runningExecution = this.runningExecutions.get(execution.id);
        if (runningExecution?.resourceMonitor) {
          clearInterval(runningExecution.resourceMonitor);
        }
        this.runningExecutions.delete(execution.id);

        // Collect artifacts
        const artifacts = await this.collectArtifacts(outputDir);

        // Get final logs
        const logFile = path.join(workspaceDir.replace('/workspace', '/logs'), 'execution.log');
        let logs = '';
        try {
          logs = await fs.readFile(logFile, 'utf8');
        } catch {
          logs = stdout + stderr;
        }

        if (code === 0) {
          await execution.complete(code, stdout, stderr, undefined, artifacts);
        } else {
          const errorMessage = signal ? `Process killed by signal: ${signal}` : `Process exited with code: ${code}`;
          await execution.fail(errorMessage, stderr, code);
        }

        // Cleanup workspace
        await this.cleanupExecution(executionId);

        this.emit('execution-completed', {
          executionId: execution.id,
          exitCode: code,
          signal,
          duration: execution.duration
        });

      } catch (error) {
        console.error('Error handling process exit:', error);
      }
    });

    // Handle process error
    process.on('error', async (error) => {
      try {
        await execution.fail(`Process error: ${error.message}`);
        this.runningExecutions.delete(execution.id);
        
        this.emit('execution-error', {
          executionId: execution.id,
          error: error.message
        });

        await this.cleanupExecution(executionId);
      } catch (cleanupError) {
        console.error('Error handling process error:', cleanupError);
      }
    });
  }

  /**
   * Start resource monitoring for execution
   */
  private startResourceMonitoring(executionId: string): void {
    const runningExecution = this.runningExecutions.get(executionId);
    if (!runningExecution) return;

    const monitor = setInterval(async () => {
      try {
        const containerStats = await this.getContainerStats(runningExecution.containerId);
        if (containerStats) {
          await runningExecution.execution.updateResourceUsage(containerStats);
          
          this.emit('execution-progress', {
            executionId,
            status: runningExecution.execution.status,
            resourceUsage: {
              memoryMB: containerStats.maxMemoryMB || 0,
              cpuPercent: containerStats.maxCpuPercent || 0,
              diskUsedMB: containerStats.diskUsedMB || 0
            }
          } as ExecutionProgress);
        }
      } catch (error) {
        console.warn(`Failed to monitor resources for execution ${executionId}:`, error);
      }
    }, MONITORING_CONFIG.RESOURCE_CHECK_INTERVAL);

    runningExecution.resourceMonitor = monitor;
  }

  /**
   * Get Docker container statistics
   */
  private async getContainerStats(containerId: string): Promise<{
    maxMemoryMB?: number;
    maxCpuPercent?: number;
    diskUsedMB?: number;
    networkBytesIn?: number;
    networkBytesOut?: number;
  } | null> {
    return new Promise((resolve) => {
      const statsProcess = spawn('docker', ['stats', '--no-stream', '--format', 'json', containerId]);
      
      let output = '';
      
      if (statsProcess.stdout) {
        statsProcess.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });
      }
      
      statsProcess.on('exit', (code) => {
        if (code === 0 && output.trim()) {
          try {
            const stats = JSON.parse(output.trim());
            resolve({
              maxMemoryMB: parseFloat(stats.MemUsage?.split('/')[0]?.replace('MiB', '')) || 0,
              maxCpuPercent: parseFloat(stats.CPUPerc?.replace('%', '')) || 0,
              diskUsedMB: parseFloat(stats.BlockIO?.split('/')[1]?.replace('MB', '')) || 0,
              networkBytesIn: parseFloat(stats.NetIO?.split('/')[0]?.replace('MB', '')) || 0,
              networkBytesOut: parseFloat(stats.NetIO?.split('/')[1]?.replace('MB', '')) || 0
            });
          } catch (error) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        statsProcess.kill();
        resolve(null);
      }, 5000);
    });
  }

  /**
   * Collect execution artifacts
   */
  private async collectArtifacts(outputDir: string): Promise<string[]> {
    try {
      const files = await fs.readdir(outputDir, { withFileTypes: true });
      const artifacts: string[] = [];
      
      for (const file of files) {
        if (file.isFile()) {
          artifacts.push(path.join(outputDir, file.name));
        }
      }
      
      return artifacts;
    } catch (error) {
      console.warn('Failed to collect artifacts:', error);
      return [];
    }
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string, reason?: string): Promise<void> {
    const runningExecution = this.runningExecutions.get(executionId);
    if (!runningExecution) {
      throw new ValidationError(`Execution not found or not running: ${executionId}`);
    }

    try {
      // Stop Docker container
      spawn('docker', ['kill', runningExecution.containerId]);
      
      // Update execution record
      await runningExecution.execution.cancel(reason);
      
      // Cleanup
      this.runningExecutions.delete(executionId);
      if (runningExecution.resourceMonitor) {
        clearInterval(runningExecution.resourceMonitor);
      }

      this.emit('execution-cancelled', {
        executionId,
        reason
      });

    } catch (error) {
      throw new ScriptError(
        `Failed to cancel execution: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { executionId, error: error as Error }
      );
    }
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId: string): Promise<ScriptExecution | null> {
    return await ScriptExecution.findByPk(executionId);
  }

  /**
   * Get execution logs
   */
  async getExecutionLogs(executionId: string): Promise<string> {
    const execution = await ScriptExecution.findByPk(executionId);
    if (!execution) {
      throw new ValidationError(`Execution not found: ${executionId}`);
    }

    return execution.logs || '';
  }

  /**
   * Cleanup execution workspace
   */
  private async cleanupExecution(executionId: string): Promise<void> {
    try {
      const workspaceDir = path.join(this.config.tempStoragePath, executionId);
      await fs.rm(workspaceDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup execution workspace: ${executionId}`, error);
    }
  }

  /**
   * Cleanup stale executions
   */
  private async cleanupStaleExecutions(): Promise<void> {
    const staleTime = Date.now() - (4 * 60 * 60 * 1000); // 4 hours

    for (const [executionId, runningExecution] of this.runningExecutions) {
      if (runningExecution.startTime.getTime() < staleTime) {
        try {
          await this.cancelExecution(executionId, 'Stale execution cleanup');
        } catch (error) {
          console.warn(`Failed to cleanup stale execution: ${executionId}`, error);
        }
      }
    }
  }

  /**
   * Get running executions count
   */
  getRunningExecutionsCount(): number {
    return this.runningExecutions.size;
  }

  /**
   * Get running executions details
   */
  getRunningExecutions(): Array<{
    executionId: string;
    scriptId: string;
    containerId: string;
    startTime: Date;
    duration: number;
  }> {
    const result: Array<{
      executionId: string;
      scriptId: string;
      containerId: string;
      startTime: Date;
      duration: number;
    }> = [];

    for (const [executionId, runningExecution] of this.runningExecutions) {
      result.push({
        executionId,
        scriptId: runningExecution.execution.scriptId,
        containerId: runningExecution.containerId,
        startTime: runningExecution.startTime,
        duration: Date.now() - runningExecution.startTime.getTime()
      });
    }

    return result;
  }
}

export default ExecutionEngine;