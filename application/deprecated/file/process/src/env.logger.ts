import { inspect } from 'util';
import { LoggerParameters } from './env.logger.parameters';

enum ELogLevels {
    INFO = 'INFO',
    DEBUG = 'DEBUG',
    WARNING = 'WARNING',
    VERBOS = 'VERBOS',
    ERROR = 'ERROR',
    ENV = 'ENV',
}

export type TOutputFunc = (...args: any[]) => any;

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

    public setOutput(output: TOutputFunc) {
        if (typeof output !== 'function') {
            this.error(`Fail to setup output function, because it should function, but had gotten: ${typeof output}`);
        }
        this._parameters.output = output;
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

    private _console(message: string, level: ELogLevels) {
        if (!this._parameters.console) {
            return false;
        }
        /* tslint:disable */
        this._parameters.allowedConsole[level] && console.log(message);
        /* tslint:enable */
    }

    private _output(message: string) {
        if (typeof this._parameters.output === 'function') {
            this._parameters.output(message);
            return true;
        } else {
            return false;
        }
    }

    private _getMessage(...args: any[]) {
        let message = ``;
        if (args instanceof Array) {
            args.forEach((smth: any, index: number) => {
                if (typeof smth !== 'string') {
                    message = `${message} (type: ${(typeof smth)}): ${inspect(smth)}`;
                } else {
                    message = `${message}${smth}`;
                }
                index < (args.length - 1) && (message = `${message},\n `);
            });
        }
        return message;
    }

    private _getTime(): string {
        const time: Date = new Date();
        return `${time.toJSON()}`;
    }

    private _log(message: string, level: ELogLevels) {
        message = `[${this._signature}]: ${message}`;
        if (!this._output(`[${this._getTime()}]${message}`)) {
            this._console(`[${this._getTime()}]${message}`, level);
        }
        return message;
    }

}
