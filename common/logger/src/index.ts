/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/*
Prints log messages depending on the debug level passed in. Defaults to 0.
0  Prints no logs.
1  Prints only errors.
2  Prints errors and warnings.
3  Prints also info logs.
4  Prints all logs (info + debug + warn + error).
*/
export enum LogLevel {
  /**
   * Prints no logs.
   */
  Disabled = 0,
  /**
   * Prints only errors.
   */
  Errors = 1,
  /**
   * Prints errors and warnings.
   */
  Warnings = 2,
  /**
   * Prints info, errors and warnings.
   */
  Info = 3,
  /**
   * Prints all logs (Info + Debug).
   */
  All = 4,
}

export class Logger {
  #logLevel = LogLevel.Disabled;
  #prefix: string;

  constructor(prefix = "[artico]", logLevel: LogLevel = LogLevel.Errors) {
    this.#prefix = prefix;
    this.#logLevel = logLevel;
  }

  get logLevel(): LogLevel {
    return this.#logLevel;
  }

  set logLevel(logLevel: LogLevel) {
    this.#logLevel = logLevel;
  }

  debug(...args: any[]) {
    if (this.#logLevel >= LogLevel.All) {
      this.#print(LogLevel.All, ...args);
    }
  }

  log(...args: any[]) {
    if (this.#logLevel >= LogLevel.Info) {
      this.#print(LogLevel.All, ...args);
    }
  }

  warn(...args: any[]) {
    if (this.#logLevel >= LogLevel.Warnings) {
      this.#print(LogLevel.Warnings, ...args);
    }
  }

  error(...args: any[]) {
    if (this.#logLevel >= LogLevel.Errors) {
      this.#print(LogLevel.Errors, ...args);
    }
  }

  #print(logLevel: LogLevel, ...rest: any[]): void {
    const copy = [this.#prefix, ...rest];

    copy.forEach((item, i) => {
      if (item instanceof Error) {
        copy[i] = `(${item.name}) ${item.message}`;
      }
    })

    if (logLevel >= LogLevel.All) {
      console.debug(...copy);
    } else if (logLevel >= LogLevel.Info) {
      console.log(...copy);
    } else if (logLevel >= LogLevel.Warnings) {
      console.warn("WARNING", ...copy);
    } else if (logLevel >= LogLevel.Errors) {
      console.error("ERROR", ...copy);
    }
  }
}
