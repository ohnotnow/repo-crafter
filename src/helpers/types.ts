// Type definitions for the repo-crafter application

export interface AppLogger {
  child(bindings: Record<string, unknown>): AppLogger;
  trace(...args: any[]): void;
  debug(...args: any[]): void;
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

export interface RepositoryRequest {
  body: {
    organization?: string;
    repositoryName?: string;
    repositoryAdmin?: string;
    visibility?: 'public' | 'private' | 'internal';
    [key: string]: any;
  };
  headers?: { [key: string]: string };
}

export interface Response {
  json: (data: any) => void;
}

export interface ApiError {
  success: false;
  errorCode: string;
  message: string;
  timestamp: string;
}

export interface ApiSuccess {
  success: true;
  message: string;
  timestamp: string;
  repository: {
    name: string;
    organization: string;
    fullName: string;
    url: string;
    admin?: string;
    visibility: string;
  };
}
