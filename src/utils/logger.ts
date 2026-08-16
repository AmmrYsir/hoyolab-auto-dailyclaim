import { sanitizeText } from './sanitizer.ts';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

class Logger {
  private currentLevel: LogLevel = 'info';

  constructor() {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
    if (envLevel && envLevel in LOG_LEVELS) {
      this.currentLevel = envLevel;
    }
  }

  public setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  private formatTimestamp(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const y = now.getFullYear();
    const m = pad(now.getMonth() + 1);
    const d = pad(now.getDate());
    const h = pad(now.getHours());
    const min = pad(now.getMinutes());
    const s = pad(now.getSeconds());
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.currentLevel];
  }

  private print(level: LogLevel, color: string, prefix: string, message: unknown, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return;

    const timeStr = `${COLORS.gray}[${this.formatTimestamp()}]${COLORS.reset}`;
    const levelStr = `${color}${prefix.padEnd(5)}${COLORS.reset}`;

    const formatItem = (item: unknown): string => {
      if (typeof item === 'string') {
        return sanitizeText(item);
      }
      if (item instanceof Error) {
        return sanitizeText(`${item.message}\n${item.stack ?? ''}`);
      }
      try {
        return sanitizeText(JSON.stringify(item, null, 2));
      } catch {
        return String(item);
      }
    };

    const formattedMessage = formatItem(message);
    const formattedArgs = args.map(formatItem).join(' ');

    const output = formattedArgs
      ? `${timeStr} ${levelStr} ${formattedMessage} ${formattedArgs}`
      : `${timeStr} ${levelStr} ${formattedMessage}`;

    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  public debug(message: unknown, ...args: unknown[]): void {
    this.print('debug', COLORS.magenta, 'DEBUG', message, ...args);
  }

  public info(message: unknown, ...args: unknown[]): void {
    this.print('info', COLORS.cyan, 'INFO', message, ...args);
  }

  public success(message: unknown, ...args: unknown[]): void {
    this.print('info', COLORS.green, 'OK', message, ...args);
  }

  public warn(message: unknown, ...args: unknown[]): void {
    this.print('warn', COLORS.yellow, 'WARN', message, ...args);
  }

  public error(message: unknown, ...args: unknown[]): void {
    this.print('error', COLORS.red, 'ERROR', message, ...args);
  }
}

export const logger = new Logger();
