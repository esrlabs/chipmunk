import { getProp, asAnyObj } from '../env/obj';
import { LOGS_LEVEL_TABLE, Level, NumericLevel } from './levels';

export function cutUuid(uuid: string): string {
    return uuid.substring(0, 8);
}

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
    return str as Level;
}

export function strToLogLevel(level: string): Level {
    if (getProp(LOGS_LEVEL_TABLE, level) === undefined) {
        return Level.WARNING;
    } else {
        return getProp(LOGS_LEVEL_TABLE, level) as Level;
    }
}

export function numToLogLevel(level: number): Level {
    return NumericLevel[level] === undefined ? Level.WARNING : NumericLevel[level];
}

export function error(err: Error | unknown): string {
    if (typeof err === 'string') {
        return err;
    } else if (err instanceof Error) {
        return err.message;
    } else if (err === undefined || err === null) {
        return `undefined/null`;
    } else if (typeof err === 'object') {
        if (
            Object.keys(err).length === 1 &&
            typeof (err as any)[Object.keys(err)[0]] === 'string'
        ) {
            return `${Object.keys(err)[0]}: ${(err as any)[Object.keys(err)[0]]}`;
        } else {
            try {
                const msg = JSON.stringify(err);
                return msg.length > 250 ? `${msg.substring(0, 250)}(...)` : msg;
            } catch (_) {
                return `${err}`;
            }
        }
    } else if (typeof (err as any).toString === 'function') {
        return (err as any).toString() as string;
    } else {
        return `${err}`;
    }
}

export function getErrorCode(err: Error | unknown): number | string | undefined {
    const code = asAnyObj(err)['code'];
    return typeof code === 'string' ? code : typeof code === 'number' ? code : undefined;
}
