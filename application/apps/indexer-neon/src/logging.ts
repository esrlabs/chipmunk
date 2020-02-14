import { ILogger, TLogFunc } from '../../../common/interfaces/interface.node.global';

export function log(s: any) {
    if ((global as any).chipmunk !== undefined) {
        (global as any).chipmunk.logger.debug(s);
    } else if (typeof s === 'string') {
        console.log("[JS]: %d: %s", new Date().getTime(), s);
    } else {
        console.log(s);
    }
}

export function getLogger(): ILogger {
    if ((global as any).chipmunk !== undefined) {
        return (global as any).chipmunk.logger as ILogger;
    } else {
        return {
            warn: console.warn as TLogFunc,
            debug: console.debug as TLogFunc,
            env: console.info as TLogFunc,
            error: console.error as TLogFunc,
            info: console.info as TLogFunc,
            verbose: console.log as TLogFunc,
            wtf: console.error as TLogFunc,
        };
    }
}
