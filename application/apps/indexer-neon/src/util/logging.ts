import { Logger, TLogFunc, IChipmunkNodeGlobal } from '../../../../common/interfaces/interface.node.global';

export { Logger };

export function log(s: any) {
    if ((global as any).chipmunk !== undefined) {
        (global as any).chipmunk.logger.debug(s);
    } else if (typeof s === 'string') {
        console.log("[JS]: %d: %s", new Date().getTime(), s);
    } else {
        console.log(s);
    }
}

export function getLogger(alias: string): Logger {
    const signature: string = `|Neon|>${alias}`;
    if ((global as any).chipmunk !== undefined) {
        const globals = (global as any).chipmunk as IChipmunkNodeGlobal;
        return new globals.Logger(signature);
    } else {
        const msg = (args: any[]): string => {
            return `${signature}: ${args.map(l => typeof l === 'string' ? l : JSON.stringify(l)).join('\n')}`;
        }
        return {
            warn: ((...args: any[]) => {
                console.warn(msg(args));
            }) as TLogFunc,
            debug: ((...args: any[]) => {
                console.debug(msg(args));
            }) as TLogFunc,
            env: ((...args: any[]) => {
                console.info(msg(args));
            }) as TLogFunc,
            error: ((...args: any[]) => {
                console.error(msg(args));
            }) as TLogFunc,
            info: ((...args: any[]) => {
                console.info(msg(args));
            }) as TLogFunc,
            verbose: ((...args: any[]) => {
                console.log(msg(args));
            }) as TLogFunc,
            wtf: ((...args: any[]) => {
                console.error(msg(args));
            }) as TLogFunc,
        };
    }
}
