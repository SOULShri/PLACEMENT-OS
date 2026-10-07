export interface LogDetails {
  request_id: string;
  tenant_id?: string;
  user_id?: string;
  ip_address: string;
  latency: number;
  endpoint: string;
  method: string;
  status: number;
  browser?: string;
  os?: string;
  device?: string;
}

export const logger = {
  info(message: string, details?: Record<string, unknown>) {
    console.log(
      JSON.stringify({
        level: 'INFO',
        timestamp: new Date().toISOString(),
        message,
        ...details,
      })
    );
  },
  
  warn(message: string, details?: Record<string, unknown>) {
    console.warn(
      JSON.stringify({
        level: 'WARN',
        timestamp: new Date().toISOString(),
        message,
        ...details,
      })
    );
  },

  error(message: string, error?: unknown, details?: Record<string, unknown>) {
    console.error(
      JSON.stringify({
        level: 'ERROR',
        timestamp: new Date().toISOString(),
        message,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        ...details,
      })
    );
  },

  logRequest(details: LogDetails) {
    console.log(
      JSON.stringify({
        level: 'HTTP',
        timestamp: new Date().toISOString(),
        ...details,
      })
    );
  }
};
