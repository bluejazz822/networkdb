/**
 * Utility functions for script management and execution
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { SECURITY_PATTERNS, SCRIPT_EXTENSIONS, ERROR_CODES } from './config';

/**
 * Error classes for script operations
 */
export class ScriptError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ScriptError';
  }
}

export class ValidationError extends ScriptError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.VALIDATION_ERROR, details);
    this.name = 'ValidationError';
  }
}

export class SecurityError extends ScriptError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.SECURITY_VIOLATION, details);
    this.name = 'SecurityError';
  }
}

export class ResourceError extends ScriptError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.RESOURCE_LIMIT_EXCEEDED, details);
    this.name = 'ResourceError';
  }
}

/**
 * Generate SHA-256 hash for file content
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (error) {
    throw new ScriptError(
      `Failed to calculate file hash: ${(error as Error).message}`,
      ERROR_CODES.INVALID_SCRIPT,
      { filePath, error: error as Error }
    );
  }
}

/**
 * Calculate hash for string content
 */
export function calculateContentHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Validate script content for security issues
 */
export function validateScriptSecurity(content: string, language: string): void {
  const violations: string[] = [];
  
  // Check for system commands
  const systemMatches = content.match(SECURITY_PATTERNS.SYSTEM_COMMANDS);
  if (systemMatches) {
    violations.push(`System commands detected: ${systemMatches.join(', ')}`);
  }
  
  // Check for network commands
  const networkMatches = content.match(SECURITY_PATTERNS.NETWORK_COMMANDS);
  if (networkMatches) {
    violations.push(`Network commands detected: ${networkMatches.join(', ')}`);
  }
  
  // Check for service commands
  const serviceMatches = content.match(SECURITY_PATTERNS.SERVICE_COMMANDS);
  if (serviceMatches) {
    violations.push(`Service commands detected: ${serviceMatches.join(', ')}`);
  }
  
  // Check for filesystem operations
  const fsMatches = content.match(SECURITY_PATTERNS.FILESYSTEM_OPS);
  if (fsMatches) {
    violations.push(`Filesystem operations detected: ${fsMatches.join(', ')}`);
  }
  
  // Check for process control
  const processMatches = content.match(SECURITY_PATTERNS.PROCESS_CONTROL);
  if (processMatches) {
    violations.push(`Process control commands detected: ${processMatches.join(', ')}`);
  }
  
  // Language-specific validations
  if (language === 'python') {
    // Check for dangerous Python imports
    const dangerousImports = /import\s+(os|sys|subprocess|shutil|pickle|exec|eval|compile)/gi;
    const importMatches = content.match(dangerousImports);
    if (importMatches) {
      violations.push(`Dangerous Python imports detected: ${importMatches.join(', ')}`);
    }
    
    // Check for eval/exec usage
    const evalPattern = /\b(eval|exec|compile)\s*\(/gi;
    const evalMatches = content.match(evalPattern);
    if (evalMatches) {
      violations.push(`Dynamic code execution detected: ${evalMatches.join(', ')}`);
    }
  }
  
  if (violations.length > 0) {
    throw new SecurityError(
      'Script contains security violations',
      { violations, content: content.substring(0, 500) + '...' }
    );
  }
}

/**
 * Validate script file extension matches language
 */
export function validateScriptExtension(fileName: string, language: string): void {
  const ext = path.extname(fileName).toLowerCase();
  const allowedExtensions = SCRIPT_EXTENSIONS[language as keyof typeof SCRIPT_EXTENSIONS];
  
  if (!allowedExtensions || !allowedExtensions.includes(ext)) {
    throw new ValidationError(
      `Invalid file extension '${ext}' for language '${language}'`,
      {
        fileName,
        language,
        extension: ext,
        allowedExtensions
      }
    );
  }
}

/**
 * Sanitize script parameters
 */
export function sanitizeParameters(parameters: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(parameters)) {
    // Sanitize parameter keys
    const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '');
    if (sanitizedKey !== key) {
      throw new ValidationError(
        `Invalid parameter key: ${key}`,
        { originalKey: key, sanitizedKey }
      );
    }
    
    // Sanitize parameter values based on type
    if (typeof value === 'string') {
      // Remove potentially dangerous characters from strings
      const sanitizedValue = value.replace(/[;&|`$(){}[\]]/g, '');
      if (sanitizedValue !== value) {
        throw new ValidationError(
          `Parameter value contains invalid characters: ${key}`,
          { key, originalValue: value, sanitizedValue }
        );
      }
      sanitized[sanitizedKey] = sanitizedValue;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[sanitizedKey] = value;
    } else if (Array.isArray(value)) {
      // Recursively sanitize array elements
      sanitized[sanitizedKey] = value.map(item => 
        typeof item === 'string' ? item.replace(/[;&|`$(){}[\]]/g, '') : item
      );
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize object properties
      sanitized[sanitizedKey] = sanitizeParameters(value);
    } else {
      sanitized[sanitizedKey] = value;
    }
  }
  
  return sanitized;
}

/**
 * Generate unique execution ID
 */
export function generateExecutionId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(8).toString('hex');
  return `exec_${timestamp}_${randomPart}`;
}

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human readable format
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
}

/**
 * Parse memory limit string to bytes
 */
export function parseMemoryLimit(limit: string): number {
  const units = {
    'b': 1,
    'k': 1024,
    'm': 1024 * 1024,
    'g': 1024 * 1024 * 1024,
    't': 1024 * 1024 * 1024 * 1024
  };
  
  const match = limit.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([kmgt]?b?)$/);
  if (!match) {
    throw new ValidationError(`Invalid memory limit format: ${limit}`);
  }
  
  const [, amount, unit] = match;
  const multiplier = units[unit.charAt(0) as keyof typeof units] || 1;
  
  return Math.floor(parseFloat(amount) * multiplier);
}

/**
 * Parse CPU limit string to number
 */
export function parseCpuLimit(limit: string): number {
  const cpu = parseFloat(limit);
  if (isNaN(cpu) || cpu <= 0) {
    throw new ValidationError(`Invalid CPU limit: ${limit}`);
  }
  return cpu;
}

/**
 * Validate resource limits
 */
export function validateResourceLimits(limits: {
  memory?: string;
  cpu?: string;
  disk?: string;
}): void {
  if (limits.memory) {
    const memoryBytes = parseMemoryLimit(limits.memory);
    if (memoryBytes > 8 * 1024 * 1024 * 1024) { // 8GB max
      throw new ResourceError(`Memory limit exceeds maximum: ${limits.memory}`);
    }
  }
  
  if (limits.cpu) {
    const cpu = parseCpuLimit(limits.cpu);
    if (cpu > 8) { // 8 CPUs max
      throw new ResourceError(`CPU limit exceeds maximum: ${limits.cpu}`);
    }
  }
  
  if (limits.disk) {
    const diskBytes = parseMemoryLimit(limits.disk);
    if (diskBytes > 50 * 1024 * 1024 * 1024) { // 50GB max
      throw new ResourceError(`Disk limit exceeds maximum: ${limits.disk}`);
    }
  }
}

/**
 * Create directory if it doesn't exist
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Clean up old files in directory
 */
export async function cleanupOldFiles(
  dirPath: string, 
  maxAge: number = 24 * 60 * 60 * 1000 // 24 hours
): Promise<number> {
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    let cleanedCount = 0;
    const cutoffTime = Date.now() - maxAge;
    
    for (const file of files) {
      if (file.isFile()) {
        const filePath = path.join(dirPath, file.name);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          cleanedCount++;
        }
      }
    }
    
    return cleanedCount;
  } catch (error) {
    throw new ScriptError(
      `Failed to cleanup old files: ${(error as Error).message}`,
      ERROR_CODES.EXECUTION_ERROR,
      { dirPath, error: error as Error }
    );
  }
}

/**
 * Extract script metadata from content
 */
export function extractScriptMetadata(content: string): {
  description?: string;
  author?: string;
  version?: string;
  requirements?: string[];
  parameters?: Array<{ name: string; type: string; description?: string; required?: boolean }>;
} {
  const metadata: any = {};
  
  // Extract description from docstring (Python) or comments
  const docstringMatch = content.match(/"""([\s\S]*?)"""/);
  if (docstringMatch) {
    metadata.description = docstringMatch[1].trim();
  } else {
    const commentMatch = content.match(/^#\s*(.+)/m);
    if (commentMatch) {
      metadata.description = commentMatch[1].trim();
    }
  }
  
  // Extract author
  const authorMatch = content.match(/@author\s+(.+)/i);
  if (authorMatch) {
    metadata.author = authorMatch[1].trim();
  }
  
  // Extract version
  const versionMatch = content.match(/@version\s+(.+)/i);
  if (versionMatch) {
    metadata.version = versionMatch[1].trim();
  }
  
  // Extract requirements (Python)
  const requirementsMatches = content.match(/(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
  if (requirementsMatches) {
    metadata.requirements = Array.from(new Set(
      requirementsMatches.map(match => match.replace(/(?:import|from)\s+/, ''))
    ));
  }
  
  // Extract parameters from comments
  const paramMatches = content.match(/@param\s+(\w+)\s+(\w+)\s*(.*)/gi);
  if (paramMatches) {
    metadata.parameters = paramMatches.map(match => {
      const parts = match.match(/@param\s+(\w+)\s+(\w+)\s*(.*)/i);
      return {
        name: parts![1],
        type: parts![2],
        description: parts![3]?.trim(),
        required: !parts![3]?.includes('optional')
      };
    });
  }
  
  return metadata;
}

/**
 * Validate script name format
 */
export function validateScriptName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Script name is required');
  }
  
  if (name.length < 3 || name.length > 100) {
    throw new ValidationError('Script name must be between 3 and 100 characters');
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new ValidationError(
      'Script name can only contain letters, numbers, underscores, and hyphens'
    );
  }
}

/**
 * Generate script file name from name and version
 */
export function generateScriptFileName(name: string, version: string, language: string): string {
  const extensions = SCRIPT_EXTENSIONS[language as keyof typeof SCRIPT_EXTENSIONS];
  const extension = extensions ? extensions[0] : '.txt';
  return `${name}_v${version.replace(/\./g, '_')}${extension}`;
}