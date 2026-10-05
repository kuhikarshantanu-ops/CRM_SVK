export interface StructuredLog {
  severity: 'INFO' | 'WARNING' | 'ERROR';
  component: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export const logger = {
  info(component: string, message: string, metadata?: Record<string, any>) {
    const entry: StructuredLog = {
      severity: 'INFO',
      component,
      message,
      metadata,
      timestamp: new Date().toISOString()
    };
    console.log(JSON.stringify(entry));
  },
  warn(component: string, message: string, metadata?: Record<string, any>) {
    const entry: StructuredLog = {
      severity: 'WARNING',
      component,
      message,
      metadata,
      timestamp: new Date().toISOString()
    };
    console.warn(JSON.stringify(entry));
  },
  error(component: string, message: string, metadata?: Record<string, any>) {
    const entry: StructuredLog = {
      severity: 'ERROR',
      component,
      message,
      metadata,
      timestamp: new Date().toISOString()
    };
    console.error(JSON.stringify(entry));
  }
};
