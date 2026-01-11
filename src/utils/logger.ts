type LogLevel = 'info' | 'warn' | 'error';

const LOG_FORMAT = String(process.env.LOG_FORMAT || 'json').toLowerCase();

export function log(level: LogLevel, message: string, meta: Record<string, any> = {}) {
  const payload = { level, message, time: new Date().toISOString(), ...meta };
  if (LOG_FORMAT === 'pretty') {
    console.log(`[${level}] ${message}`, meta);
    return;
  }
  console.log(JSON.stringify(payload));
}

export const logInfo = (message: string, meta?: Record<string, any>) => log('info', message, meta);
export const logWarn = (message: string, meta?: Record<string, any>) => log('warn', message, meta);
export const logError = (message: string, meta?: Record<string, any>) => log('error', message, meta);
