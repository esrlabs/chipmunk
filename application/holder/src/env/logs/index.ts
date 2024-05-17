import { Logger as Base, Level, utils, state } from 'platform/log';
import { FileStore } from './filestore';
import { envvars } from '@loader/envvars';

import * as path from 'path';

const store = new FileStore();

export function setLogLevelFromEnvvars(): void {
    const level = (() => {
        const level = utils.getLogLevelFromStr(envvars.get().CHIPMUNK_DEV_LOGLEVEL);
        if (envvars.get().CHIPMUNK_DEVELOPING_MODE === true && level === undefined) {
            return Level.VERBOS;
        } else if (level !== undefined) {
            return level;
        } else {
            return Level.DEBUG;
        }
    })();
    state.setLevel(level);
}

export function setHomePath(home: string): Promise<void> {
    return store.bind(path.resolve(home, `chipmunk.log`));
}

export function unbind(): Promise<void> {
    return store.unbind();
}

export function error(err: Error | unknown): string {
    return `${err instanceof Error ? err.message : err}`;
}

export class Logger extends Base {
    public override store(message: string, level: Level): void {
        if (!state.isWritable(level)) {
            return;
        }
        store.write(message);
    }
}
