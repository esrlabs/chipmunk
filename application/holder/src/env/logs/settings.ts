import { Level, LOGS_LEVEL_TABLE, getLogLevelFromStr } from 'platform/env/logger';
import { envvars } from '@loader/envvars';

export const DEFAUT_ALLOWED_CONSOLE = {
    DEBUG: true,
    ERROR: true,
    INFO: true,
    VERBOS: false,
    WARNING: true,
};

export class Settings {
    public static getDefaultLevel(): Level {
        if (envvars.get().CHIPMUNK_DEVELOPING_MODE === true) {
            return Level.VERBOS;
        }
        const devLevel = getLogLevelFromStr(envvars.get().CHIPMUNK_DEV_LOGLEVEL);
        if (devLevel !== undefined) {
            return devLevel;
        }
        return Level.DEBUG;
    }

    protected level: Level = Settings.getDefaultLevel();
    protected allowed: { [key: string]: boolean } = {};

    constructor() {
        this._update();
    }

    public getAllowedConsole(): { [key: string]: boolean } {
        return this.allowed;
    }

    public refreshFromEnvVars() {
        this.level = Settings.getDefaultLevel();
        this._update();
    }

    private _update() {
        this.allowed = Object.assign({}, DEFAUT_ALLOWED_CONSOLE);
        Object.keys(this.allowed).forEach((key: string) => {
            this.allowed[key] = LOGS_LEVEL_TABLE[this.level].includes(key as Level);
        });
    }
}

export const settings = new Settings();
