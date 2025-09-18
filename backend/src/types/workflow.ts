/**
 * n8n Workflow Integration Types
 * TypeScript interfaces for n8n workflow objects, execution status, and API responses
 */

import { ApiResponse, ErrorResponse } from './common';

// n8n Workflow Execution Status
export type WorkflowExecutionStatus = 
  | 'new'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'crashed'
  | 'waiting';

// n8n Workflow Status
export type WorkflowStatus = 'active' | 'inactive';

// n8n Node Execution Status
export type NodeExecutionStatus = 
  | 'success'
  | 'error'
  | 'running'
  | 'waiting'
  | 'disabled';

// Base n8n Entity
export interface N8nBaseEntity {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// n8n Workflow Node
export interface N8nWorkflowNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
  credentials?: Record<string, string>;
  webhookId?: string;
  disabled?: boolean;
}

// n8n Workflow Connection
export interface N8nWorkflowConnection {
  node: string;
  type: 'main' | 'error';
  index: number;
}

// n8n Workflow Connections Map
export interface N8nWorkflowConnections {
  [nodeId: string]: {
    main?: N8nWorkflowConnection[][];
    error?: N8nWorkflowConnection[][];
  };
}

// n8n Workflow Settings
export interface N8nWorkflowSettings {
  executeInOrder?: boolean;
  saveDataErrorExecution?: 'all' | 'none';
  saveDataSuccessExecution?: 'all' | 'none';
  saveExecutionProgress?: boolean;
  saveManualExecutions?: boolean;
  timezone?: string;
  errorWorkflow?: string;
}

// n8n Workflow Static Data
export interface N8nWorkflowStaticData {
  node?: Record<string, any>;
  global?: Record<string, any>;
}

// Main n8n Workflow interface
export interface N8nWorkflow extends N8nBaseEntity {
  active: boolean;
  nodes: N8nWorkflowNode[];
  connections: N8nWorkflowConnections;
  settings?: N8nWorkflowSettings;
  staticData?: N8nWorkflowStaticData;
  tags?: string[];
  pinData?: Record<string, any>;
  versionId?: string;
}

// n8n Node Execution Data
export interface N8nNodeExecutionData {
  startTime: string;
  endTime?: string;
  executionTime?: number;
  source?: Array<{
    previousNode: string;
    previousNodeOutput?: number;
  }>;
  data?: {
    main?: any[][];
    error?: any[][];
  };
  outputOverride?: Record<string, any>;
}

// n8n Node Execution Result
export interface N8nNodeExecution {
  [nodeId: string]: N8nNodeExecutionData[];
}

// n8n Workflow Execution
export interface N8nWorkflowExecution extends N8nBaseEntity {
  workflowId: string;
  mode: 'manual' | 'trigger' | 'webhook' | 'retry' | 'internal';
  finished: boolean;
  retryOf?: string;
  retrySuccessId?: string;
  status: WorkflowExecutionStatus;
  startedAt: string;
  stoppedAt?: string;
  data: {
    resultData: {
      runData: N8nNodeExecution;
      pinData?: Record<string, any>;
      lastNodeExecuted?: string;
      error?: N8nExecutionError;
    };
    executionData?: {
      contextData: Record<string, any>;
      nodeExecutionStack: any[];
      metadata: Record<string, any>;
      waitingExecution: Record<string, any>;
      waitingExecutionSource: Record<string, any>;
    };
  };
  waitTill?: string;
  workflowData?: N8nWorkflow;
}

// n8n Execution Error
export interface N8nExecutionError {
  name: string;
  message: string;
  description?: string;
  node?: {
    id: string;
    name: string;
    type: string;
  };
  timestamp: string;
  context?: Record<string, any>;
  cause?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// n8n API Error Types
export type N8nErrorCode = 
  | 'WORKFLOW_NOT_FOUND'
  | 'WORKFLOW_EXECUTION_ERROR'
  | 'INVALID_WORKFLOW_DATA'
  | 'AUTHENTICATION_FAILED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'NODE_EXECUTION_ERROR'
  | 'WEBHOOK_NOT_FOUND'
  | 'INVALID_PARAMETERS'
  | 'TIMEOUT_ERROR'
  | 'CONNECTION_ERROR'
  | 'PERMISSION_DENIED'
  | 'WORKFLOW_INACTIVE'
  | 'EXECUTION_NOT_FOUND';

// Enhanced n8n Error Response
export interface N8nErrorResponse extends ErrorResponse {
  error: {
    code: N8nErrorCode;
    message: string;
    details?: {
      workflowId?: string;
      executionId?: string;
      nodeId?: string;
      nodeName?: string;
      httpStatus?: number;
      n8nErrorCode?: string;
    };
  };
}

// Rate Limiting Configuration
export interface N8nRateLimitConfig {
  maxRequestsPerMinute: number;
  currentRequests: number;
  resetTime: Date;
  retryAfter?: number;
}

// Retry Configuration
export interface N8nRetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  exponentialBackoff: boolean;
  retryOn: N8nErrorCode[];
}

// n8n API Client Configuration
export interface N8nClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  rateLimit: N8nRateLimitConfig;
  retry: N8nRetryConfig;
  userAgent?: string;
  headers?: Record<string, string>;
}

// n8n Workflow List Response
export interface N8nWorkflowListResponse extends ApiResponse<N8nWorkflow[]> {
  total: number;
  nextCursor?: string;
}

// n8n Workflow Execution List Response
export interface N8nExecutionListResponse extends ApiResponse<N8nWorkflowExecution[]> {
  total: number;
  nextCursor?: string;
}

// n8n Workflow Query Parameters
export interface N8nWorkflowQueryParams {
  limit?: number;
  offset?: number;
  cursor?: string;
  active?: boolean;
  tags?: string[];
  search?: string;
}

// n8n Execution Query Parameters
export interface N8nExecutionQueryParams {
  workflowId?: string;
  limit?: number;
  offset?: number;
  cursor?: string;
  status?: WorkflowExecutionStatus;
  includeData?: boolean;
  startedAfter?: string; // ISO date
  startedBefore?: string; // ISO date
}

// n8n Workflow Execution Request
export interface N8nExecutionRequest {
  workflowData?: N8nWorkflow;
  runData?: Record<string, any>;
  pinData?: Record<string, any>;
  startNodes?: string[];
  destinationNode?: string;
}

// n8n Workflow Create/Update Request
export interface N8nWorkflowRequest {
  name: string;
  nodes: N8nWorkflowNode[];
  connections: N8nWorkflowConnections;
  active?: boolean;
  settings?: N8nWorkflowSettings;
  staticData?: N8nWorkflowStaticData;
  tags?: string[];
  pinData?: Record<string, any>;
}

// n8n Webhook Information
export interface N8nWebhookInfo {
  id: string;
  webhookPath: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  node: string;
  workflowId: string;
  pathLength: number;
}

// n8n Activity/Status Information
export interface N8nActivityInfo {
  activeWorkflows: number;
  activeExecutions: number;
  waitingExecutions: number;
  totalExecutions: number;
  lastExecutionTime?: string;
  systemStatus: 'healthy' | 'degraded' | 'unhealthy';
}

// Workflow Validation Result
export interface WorkflowValidationResult {
  valid: boolean;
  errors: Array<{
    node?: string;
    field?: string;
    message: string;
    code: string;
  }>;
  warnings: Array<{
    node?: string;
    field?: string;
    message: string;
    code: string;
  }>;
}

// Custom n8n Integration Metadata
export interface N8nIntegrationMetadata {
  lastSyncAt?: Date;
  syncVersion: number;
  sourceSystem: string;
  networkCmdbWorkflowId?: string;
  networkCmdbExecutionId?: string;
  triggerSource?: 'manual' | 'scheduled' | 'webhook' | 'network_event';
  relatedResourceIds?: string[];
  operationType?: 'sync' | 'validate' | 'notify' | 'backup' | 'cleanup';
}

// Network CMDB specific workflow execution context
export interface NetworkCmdbWorkflowContext {
  resourceType?: string;
  awsAccountId?: string;
  region?: string;
  operation: string;
  userId?: string;
  metadata: N8nIntegrationMetadata;
}

// Extended workflow execution with Network CMDB context
export interface NetworkCmdbWorkflowExecution extends N8nWorkflowExecution {
  networkCmdbContext?: NetworkCmdbWorkflowContext;
}

// Workflow execution statistics
export interface WorkflowExecutionStats {
  workflowId: string;
  workflowName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecutionTime?: string;
  lastSuccessTime?: string;
  lastFailureTime?: string;
  errorRate: number;
  mostCommonErrors: Array<{
    error: string;
    count: number;
  }>;
}

// Type guards for n8n objects
export const isN8nWorkflow = (obj: any): obj is N8nWorkflow => {
  return obj && typeof obj.id === 'string' && Array.isArray(obj.nodes);
};

export const isN8nWorkflowExecution = (obj: any): obj is N8nWorkflowExecution => {
  return obj && typeof obj.id === 'string' && typeof obj.workflowId === 'string';
};

export const isN8nError = (obj: any): obj is N8nErrorResponse => {
  return obj && obj.error && typeof obj.error.code === 'string';
};