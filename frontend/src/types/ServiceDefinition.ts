export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'apiKey' | 'oauth';
  setupSteps?: FlowStep[];
  commonIssues?: Record<string, string>;
}

export type FlowStepType = 'link' | 'instruction' | 'input' | 'verify' | 'automation';

export interface FlowStep {
  type: FlowStepType;
  id?: string;
  label?: string;
  text?: string;
  url?: string;
  description?: string;
  hint?: string;
  action?: string;
}

export interface Credential {
  id: string;
  serviceId: string;
  name: string;
  value: string;
  type: 'apiKey' | 'oauth';
  expiresAt?: number;
  refreshToken?: string;
  lastVerified?: number;
  metadata?: Record<string, any>;
} 