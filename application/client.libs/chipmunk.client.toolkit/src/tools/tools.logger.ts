import { LoggerParameters, ELogLevels, TOutputFunc } from './tools.logger.parameters';

export { ELogLevels };

/**
 * @class
 * Logger
 */
export default class Logger {
    private _signature: string = '';
    private _parameters: LoggerParameters = new LoggerParameters({});

    /**
     * @constructor
     * @param {string} signature        - Signature of logger instance
     * @param {LoggerParameters} params - Logger parameters
     */
    constructor(signature: string, params?: LoggerParameters) {
        params instanceof LoggerParameters && (this._parameters = params);
        this._signature = signature;
    }

    /**
     * Publish info logs
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public info(...args: any[]) {
        return this._log(this._getMessage(...args), ELogLevels.INFO);
    }

    /**
     * Publish warnings logs
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public warn(...args: any[]) {
        return this._log(this._getMessage(...args), ELogLevels.WARNING);
    }

    /**
     * Publish verbose logs
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public verbose(...args: any[]) {
        return this._log(this._getMessage(...args), ELogLevels.VERBOS);
    }

    /**
     * Publish error logs
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public error(...args: any[]) {
        return this._log(this._getMessage(...args), ELogLevels.ERROR);
    }

    /**
     * Publish debug logs
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public debug(...args: any[]) {
        return this._log(this._getMessage(...args), ELogLevels.DEBUG);
    }

    /**
     * Publish environment logs (low-level stuff, support or tools)
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public env(...args: any[]) {
        return this._log(this._getMessage(...args), ELogLevels.ENV);
    }

    public measure(operation: string): () => void {
        const started = Date.now();
        this.env(`starting "${operation}"`);
        return () => {
            const duration: number = Date.now() - started;
            this.env(
                `"${operation}" finished in: ${(duration / 1000).toFixed(2)} sec (${duration}ms)`,
            );
        };
    }

    private _console(message: string, level: ELogLevels): boolean {
        if (!this._parameters.console) {
            return false;
        }
        /* tslint:disable */
        this._parameters.getAllowedConsole()[level] && console.log(message);
        /* tslint:enable */
        return true;
    }

    private _output(message: string) {
        typeof this._parameters.output === 'function' && this._parameters.output(message);
    }

    private _callback(message: string, level: ELogLevels) {
        if (
            typeof this._parameters.getCallback() === 'function' &&
            this._parameters.getAllowedConsole()[level]
        ) {
            const cb = this._parameters.getCallback();
            cb !== undefined && cb(message, level);
        }
    }

    private _getMessage(...args: any[]) {
        let message = ``;
        if (args instanceof Array) {
            args.forEach((smth: any, index: number) => {
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

    private _log(original: string, level: ELogLevels) {
        const message: string = `[${this._signature}][${level}]: ${original}`;
        this._console(`[${this._getTime()}]${message}`, level);
        this._callback(`[${this._getTime()}]${message}`, level);
        this._output(`[${this._getTime()}]${message}`);
        return original;
    }
}
