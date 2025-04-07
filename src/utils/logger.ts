import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { LOG_LEVEL, LOG_DIR, LOG_FILE, ERROR_LOG_FILE, ENABLE_FILE_LOGGING } from './config.js';

// Define custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Create winston logger instance
export const logger = winston.createLogger({
  levels,
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'mcp-server' },
  transports: [
    // Console transport for development - redirected to stderr
    new winston.transports.Console({
      stderrLevels: ['error', 'warn', 'info', 'debug'], // Send ALL logs to stderr
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          // Filter out service from meta to avoid duplication
          const { service, ...rest } = meta;
          const metaStr = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
          return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
        })
      ),
    }),
  ],
});

// Add file transports when enabled
if (ENABLE_FILE_LOGGING) {
  // Add error log file transport
  logger.add(
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, ERROR_LOG_FILE), 
      level: 'error' 
    })
  );
  
  // Add combined log file transport
  logger.add(
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, LOG_FILE)
    })
  );
  
  logger.info(`File logging enabled: ${path.join(LOG_DIR, LOG_FILE)}`);
}

// Add stream for stderr logging (useful for debugging)
export const logStream = {
  write: (message: string) => {
    logger.debug(message.trim());
  },
};

// Update log level dynamically
export function setLogLevel(level: string): void {
  if (Object.keys(levels).includes(level)) {
    logger.level = level;
    logger.info(`Log level set to ${level}`);
  } else {
    logger.warn(`Invalid log level: ${level}. Using current level: ${logger.level}`);
  }
}
