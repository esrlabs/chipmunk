export type TLogFunc = (...args: any[]) => string;

export interface ILogger {
    verbose: TLogFunc;
    info: TLogFunc;
    env: TLogFunc;
    debug: TLogFunc;
    warn: TLogFunc;
    error: TLogFunc;
    wtf: TLogFunc;
}

export abstract class Logger {
    public abstract verbose(...args: any[]): string;
    public abstract info(...args: any[]): string;
    public abstract env(...args: any[]): string;
    public abstract debug(...args: any[]): string;
    public abstract warn(...args: any[]): string;
    public abstract error(...args: any[]): string;
    public abstract wtf(...args: any[]): string;
}

export type LoggerConstructor = new (alias: string) => Required<Logger>;

export interface IChipmunkNodeGlobal {
    logger: ILogger;
    Logger: LoggerConstructor;
}
