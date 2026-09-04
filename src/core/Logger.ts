export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
}

export class Logger {
  private static level: LogLevel = LogLevel.Info;

  static setLevel(level: LogLevel): void {
    Logger.level = level;
  }

  static debug(...args: unknown[]): void {
    if (Logger.level <= LogLevel.Debug) console.debug('[supaplex]', ...args);
  }

  static info(...args: unknown[]): void {
    if (Logger.level <= LogLevel.Info) console.info('[supaplex]', ...args);
  }

  static warn(...args: unknown[]): void {
    if (Logger.level <= LogLevel.Warn) console.warn('[supaplex]', ...args);
  }

  static error(...args: unknown[]): void {
    if (Logger.level <= LogLevel.Error) console.error('[supaplex]', ...args);
  }
}
