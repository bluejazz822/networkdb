/**
 * Script execution service configuration
 */

export interface ScriptConfig {
  // Docker configuration
  dockerImage: string;
  dockerRegistry?: string;
  dockerTimeout: number;
  
  // Execution limits
  maxConcurrentExecutions: number;
  defaultTimeout: number;
  maxTimeout: number;
  
  // Resource limits
  defaultResourceLimits: {
    memory: string;
    cpu: string;
    disk: string;
  };
  maxResourceLimits: {
    memory: string;
    cpu: string;
    disk: string;
  };
  
  // Storage configuration
  scriptsStoragePath: string;
  logsStoragePath: string;
  artifactsStoragePath: string;
  tempStoragePath: string;
  
  // Security settings
  allowedLanguages: string[];
  restrictedCommands: string[];
  maxFileSize: number;
  
  // Queue configuration
  queueName: string;
  retryAttempts: number;
  retryDelay: number;
}

export const DEFAULT_SCRIPT_CONFIG: ScriptConfig = {
  // Docker configuration
  dockerImage: 'python:3.11-slim',
  dockerTimeout: 30000, // 30 seconds for container ops
  
  // Execution limits
  maxConcurrentExecutions: parseInt(process.env.MAX_CONCURRENT_SCRIPTS || '10'),
  defaultTimeout: parseInt(process.env.DEFAULT_SCRIPT_TIMEOUT || '1800'), // 30 minutes
  maxTimeout: parseInt(process.env.MAX_SCRIPT_TIMEOUT || '7200'), // 2 hours
  
  // Resource limits
  defaultResourceLimits: {
    memory: process.env.DEFAULT_MEMORY_LIMIT || '512m',
    cpu: process.env.DEFAULT_CPU_LIMIT || '1',
    disk: process.env.DEFAULT_DISK_LIMIT || '1g'
  },
  maxResourceLimits: {
    memory: process.env.MAX_MEMORY_LIMIT || '4g',
    cpu: process.env.MAX_CPU_LIMIT || '4',
    disk: process.env.MAX_DISK_LIMIT || '10g'
  },
  
  // Storage configuration
  scriptsStoragePath: process.env.SCRIPTS_STORAGE_PATH || '/app/storage/scripts',
  logsStoragePath: process.env.LOGS_STORAGE_PATH || '/app/storage/logs',
  artifactsStoragePath: process.env.ARTIFACTS_STORAGE_PATH || '/app/storage/artifacts',
  tempStoragePath: process.env.TEMP_STORAGE_PATH || '/tmp/script-execution',
  
  // Security settings
  allowedLanguages: ['python', 'bash', 'shell', 'javascript', 'node'],
  restrictedCommands: [
    'rm', 'rmdir', 'delete', 'format', 'fdisk',
    'sudo', 'su', 'chmod', 'chown',
    'nc', 'netcat', 'telnet', 'ssh',
    'curl', 'wget', 'ping', 'nslookup',
    'systemctl', 'service', 'crontab'
  ],
  maxFileSize: parseInt(process.env.MAX_SCRIPT_FILE_SIZE || '10485760'), // 10MB
  
  // Queue configuration
  queueName: 'script-execution',
  retryAttempts: 3,
  retryDelay: 5000 // 5 seconds
};

/**
 * Script execution status constants
 */
export const EXECUTION_STATUS = {
  PENDING: 'PENDING',
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  TIMEOUT: 'TIMEOUT',
  KILLED: 'KILLED'
} as const;

/**
 * Script execution priority constants
 */
export const EXECUTION_PRIORITY = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
} as const;

/**
 * Docker image configurations for different languages
 */
export const DOCKER_IMAGES = {
  python: 'python:3.11-slim',
  bash: 'bash:5.2-alpine',
  shell: 'bash:5.2-alpine',
  javascript: 'node:18-alpine',
  node: 'node:18-alpine',
  powershell: 'mcr.microsoft.com/powershell:7.3-ubuntu-22.04'
} as const;

/**
 * Security patterns for script validation
 */
export const SECURITY_PATTERNS = {
  // Dangerous system commands
  SYSTEM_COMMANDS: /\b(rm|rmdir|delete|format|fdisk|sudo|su|chmod|chown)\b/gi,
  
  // Network commands
  NETWORK_COMMANDS: /\b(nc|netcat|telnet|ssh|curl|wget|ping|nslookup)\b/gi,
  
  // Service management
  SERVICE_COMMANDS: /\b(systemctl|service|crontab)\b/gi,
  
  // File system operations
  FILESYSTEM_OPS: /\b(mount|umount|mkfs|fsck)\b/gi,
  
  // Process control
  PROCESS_CONTROL: /\b(kill|killall|pkill|nohup|bg|fg)\b/gi
} as const;

/**
 * Default environment variables for script execution
 */
export const DEFAULT_ENVIRONMENT = {
  PATH: '/usr/local/bin:/usr/bin:/bin',
  PYTHONPATH: '/usr/local/lib/python3.11/site-packages',
  LANG: 'en_US.UTF-8',
  LC_ALL: 'en_US.UTF-8',
  TZ: 'UTC'
} as const;

/**
 * Script file extensions mapping
 */
export const SCRIPT_EXTENSIONS = {
  python: ['.py', '.python'],
  bash: ['.sh', '.bash'],
  shell: ['.sh', '.bash'],
  javascript: ['.js'],
  node: ['.js', '.mjs'],
  powershell: ['.ps1']
} as const;

/**
 * Resource monitoring intervals
 */
export const MONITORING_CONFIG = {
  RESOURCE_CHECK_INTERVAL: 5000, // 5 seconds
  LOG_FLUSH_INTERVAL: 1000, // 1 second
  HEALTH_CHECK_INTERVAL: 10000, // 10 seconds
  CLEANUP_INTERVAL: 60000 // 1 minute
} as const;

/**
 * Error codes for script execution
 */
export const ERROR_CODES = {
  INVALID_SCRIPT: 'INVALID_SCRIPT',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RESOURCE_LIMIT_EXCEEDED: 'RESOURCE_LIMIT_EXCEEDED',
  TIMEOUT_EXCEEDED: 'TIMEOUT_EXCEEDED',
  CONTAINER_ERROR: 'CONTAINER_ERROR',
  EXECUTION_ERROR: 'EXECUTION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SECURITY_VIOLATION: 'SECURITY_VIOLATION'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
export type ExecutionStatus = typeof EXECUTION_STATUS[keyof typeof EXECUTION_STATUS];
export type ExecutionPriority = typeof EXECUTION_PRIORITY[keyof typeof EXECUTION_PRIORITY];