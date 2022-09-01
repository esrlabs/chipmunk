import { Level, LOGS_LEVEL_TABLE } from '@platform/env/logger';

export const DEFAUT_ALLOWED_CONSOLE = {
    DEBUG: true,
    ERROR: true,
    INFO: false,
    VERBOS: false,
    WARNING: true,
};

export type TOutputFunc = (...args: unknown[]) => unknown;
export type TLogCallback = (message: string, level: Level) => void;

export class Settings {
    private level: Level = Level.WARNING;
    private allowed: { [key: string]: boolean } = {};

    constructor() {
        this._update();
    }

    public setLevel(level: Level) {
        this.level = level;
        this._update();
    }

    public getAllowedConsole(): { [key: string]: boolean } {
        return this.allowed;
    }

    private _update() {
        this.allowed = Object.assign({}, DEFAUT_ALLOWED_CONSOLE);
        Object.keys(this.allowed).forEach((key: string) => {
            this.allowed[key] = LOGS_LEVEL_TABLE[this.level].indexOf(key as Level) !== -1;
        });
    }
}

export const settings = new Settings();
