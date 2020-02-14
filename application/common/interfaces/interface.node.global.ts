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

export interface IChipmunkNodeGlobal {
    logger: ILogger;
}
