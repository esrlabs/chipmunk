import { LoggerParameters } from './parameters';
import { Instance, Level } from 'platform/env/logger';
import { FileStore } from './filestore';

import * as path from 'path';

const LEFT_SPACE_ON_LOGGER_SIG = 1;
const RIGHT_SPACE_ON_LOGGER_SIG = 1;
const LOG_LEVEL_MAX = 7;

const store = new FileStore();

export function setHomePath(home: string): Promise<void> {
    return store.bind(path.resolve(home, `chipmunk.log`));
}

export function unbind(): Promise<void> {
    return store.unbind();
}

export function error(err: Error | unknown): string {
    return `${err instanceof Error ? err.message : err}`;
}

export class Logger extends Instance {
    public static maxNameLength = 0;
    private _signature = '';
    private _parameters: LoggerParameters = new LoggerParameters({});

    /**
     * @constructor
     * @param {string} signature        - Signature of logger instance
     * @param {LoggerParameters} params - Logger parameters
     */
    constructor(signature: string, params?: LoggerParameters) {
        super();
        params instanceof LoggerParameters && (this._parameters = params);
        if (signature.length > Logger.maxNameLength) {
            Logger.maxNameLength = signature.length;
        }
        this._signature = `${' '.repeat(LEFT_SPACE_ON_LOGGER_SIG)}${signature}${' '.repeat(
            RIGHT_SPACE_ON_LOGGER_SIG,
        )}`;
    }

    public rename(signature: string): void {
        this._signature = `${' '.repeat(LEFT_SPACE_ON_LOGGER_SIG)}${signature}${' '.repeat(
            RIGHT_SPACE_ON_LOGGER_SIG,
        )}`;
    }

    /**
     * Publish info logs
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public info(...args: unknown[]) {
        return this._log(this._getMessage(...args), Level.INFO);
    }

    /**
     * Publish warnings logs
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public warn(...args: unknown[]) {
        return this._log(this._getMessage(...args), Level.WARNING);
    }

    /**
     * Publish verbose logs
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public verbose(...args: unknown[]) {
        return this._log(this._getMessage(...args), Level.VERBOS);
    }

    /**
     * Publish error logs
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public error(...args: unknown[]) {
        return this._log(this._getMessage(...args), Level.ERROR);
    }

    /**
     * Publish debug logs
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public debug(...args: unknown[]) {
        return this._log(this._getMessage(...args), Level.DEBUG);
    }

    /**
     * Publish debug logs
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public storable(...args: unknown[]) {
        return this._log(this._getMessage(...args), Level.STORABLE);
    }

    public measure(operation: string): () => void {
        const started = Date.now();
        this.debug(`starting "${operation}"`);
        return () => {
            const duration: number = Date.now() - started;
            this.debug(
                `"${operation}" finished in: ${(duration / 1000).toFixed(2)} sec (${duration}ms)`,
            );
        };
    }

    public write(message: string): void {
        const msg = `[${this._signature}]: ${message}`;
        store.write(msg);
        this._console(msg, Level.STORABLE);
    }

    private _console(message: string, level: Level) {
        if (!this._parameters.console) {
            return;
        }
        (level === Level.STORABLE || this._parameters.getAllowedConsole()[level]) &&
            console.log(
                `%c${message}`,
                (() => {
                    switch (level) {
                        case Level.VERBOS:
                            return 'color: grey';
                        case Level.INFO:
                            return 'color: blue';
                        case Level.DEBUG:
                            return 'color: green';
                        case Level.WARNING:
                            return 'color: yellow';
                        case Level.ERROR:
                            return 'color: red';
                        default:
                            return '';
                    }
                })(),
            );
        /* tslint:enable */
    }

    private _getMessage(...args: unknown[]) {
        let message = ``;
        if (args instanceof Array) {
            args.forEach((smth: unknown, index: number) => {
                if (typeof smth !== 'string') {
                    message = `${message} (type: ${typeof smth})`;
                } else {
                    message = `${message}${smth}`;
                }
                index < args.length - 1 && (message = `${message},\n `);
            });
        }
        return message;
    }

    private _getTime(): string {
        const time: Date = new Date();
        return `${time.toJSON()}`;
    }

    private _log(original: string, level: Level) {
        const levelStr = `${level}`;
        const fill = LOG_LEVEL_MAX - levelStr.length;
        const message = `[${this._getTime()}][${levelStr}${' '.repeat(
            fill > 0 && isFinite(fill) && !isNaN(fill) ? fill : 0,
        )}][${this._signature}]: ${original}`;
        this._console(message, level);
        store.write(message);
        return original;
    }
}
