import {
    Logger,
    TLogFunc,
    IChipmunkNodeGlobal,
} from '../../../../../common/interfaces/interface.node.global';

export { Logger };

export function log(s: any) {
    if ((global as any).chipmunk !== undefined) {
        (global as any).chipmunk.logger.debug(s);
    } else if (typeof s === 'string') {
        console.log('[JS]: %d: %s', new Date().getTime(), s);
    } else {
        console.log(s);
    }
}

enum ELevel {
    error = 'error', // 0
    warn = 'warn', // 1
    debug = 'debug', // 2
    info = 'info', // 3
    env = 'env', // 4
    verb = 'verb', // 5
    wtf = 'WTF', // 6
}

let tm: number = Date.now();
let init: number = Date.now();
let gLevel: number = 3;
let locker: string | undefined;

export function setLogLevels(level: number) {
    if (typeof locker === 'string' && locker.trim() !== '') {
        getLogger('General').warn(`Fail to change log level as soon as it's locked by "${locker}"`);
    } else {
        gLevel = level;
    }
}

export function lockChangingLogLevel(caller: string) {
    if (typeof caller === 'string' && caller.trim() !== '') {
        locker = caller;
    }
}

export function getLogger(alias: string): Logger {
    if ((global as any).chipmunk !== undefined) {
        const globals = (global as any).chipmunk as IChipmunkNodeGlobal;
        return new globals.Logger(`|RustBinding|>${alias}`);
    } else {
        const msg = (level: ELevel, args: any[]): string => {
            const now = Date.now();
            tm = Date.now();
            return `[+${now - tm}ms | ${now - init}ms\t][${level}] ${alias}: ${args
                .map((l) => (typeof l === 'string' ? l : JSON.stringify(l)))
                .join('\n')}`;
        };
        return {
            error: ((...args: any[]) => {
                gLevel !== 6 && gLevel >= 0 && console.error(msg(ELevel.error, args));
            }) as TLogFunc,
            warn: ((...args: any[]) => {
                gLevel !== 6 && gLevel >= 1 && console.warn(msg(ELevel.warn, args));
            }) as TLogFunc,
            debug: ((...args: any[]) => {
                gLevel !== 6 && gLevel >= 2 && console.debug(msg(ELevel.debug, args));
            }) as TLogFunc,
            info: ((...args: any[]) => {
                gLevel !== 6 && gLevel >= 3 && console.info(msg(ELevel.info, args));
            }) as TLogFunc,
            env: ((...args: any[]) => {
                gLevel !== 6 && gLevel >= 4 && console.info(msg(ELevel.env, args));
            }) as TLogFunc,
            verbose: ((...args: any[]) => {
                gLevel !== 6 && gLevel >= 5 && console.log(msg(ELevel.verb, args));
            }) as TLogFunc,
            wtf: ((...args: any[]) => {
                console.error(msg(ELevel.wtf, args));
            }) as TLogFunc,
        };
    }
}
