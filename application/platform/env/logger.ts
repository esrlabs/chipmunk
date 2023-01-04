import { getProp, asAnyObj } from './obj';

export enum Level {
    INFO = 'INFO',
    DEBUG = 'DEBUG',
    WARNING = 'WARNING',
    VERBOS = 'VERBOS',
    ERROR = 'ERROR',
}

export const LOGS_LEVEL_TABLE = {
    VERBOS: [Level.VERBOS, Level.DEBUG, Level.INFO, Level.WARNING, Level.ERROR],
    DEBUG: [Level.DEBUG, Level.INFO, Level.WARNING, Level.ERROR],
    INFO: [Level.INFO, Level.WARNING, Level.ERROR],
    WARNING: [Level.WARNING, Level.ERROR],
    ERROR: [Level.ERROR],
};

export function isValidLevel(level: string): boolean {
    return getLogLevelFromStr(level) !== undefined;
}

export function getLogLevelFromStr(str: any): Level | undefined {
    if (typeof str !== 'string') {
        return undefined;
    }
    str = str.toUpperCase();
    if (getProp(LOGS_LEVEL_TABLE, str) === undefined) {
        return undefined;
    }
    return getProp(LOGS_LEVEL_TABLE, str) as Level;
}

export function strToLogLevel(level: string): Level {
    if (getProp(LOGS_LEVEL_TABLE, level) === undefined) {
        return Level.WARNING;
    } else {
        return getProp(LOGS_LEVEL_TABLE, level) as Level;
    }
}

export function error(err: Error | unknown): string {
    return `${err instanceof Error ? err.message : err}`;
}

export function getErrorCode(err: Error | unknown): number | string | undefined {
    const code = asAnyObj(err)['code'];
    return typeof code === 'string' ? code : typeof code === 'number' ? code : undefined;
}

export type InstanceConstructor<T extends Instance> = new (signature: string, ...args: any[]) => T;

export abstract class Instance {
    abstract info(...args: unknown[]): string;
    abstract warn(...args: unknown[]): string;
    abstract verbose(...args: unknown[]): string;
    abstract debug(...args: unknown[]): string;
    abstract error(...args: unknown[]): string;
    abstract measure(...args: unknown[]): () => void;
    abstract rename(signature: string): void;
}
