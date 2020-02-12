import { inspect } from 'util';
import { LoggerParameters, ELogLevels, LogsService } from './env.logger.parameters';
import LogsBuffer from './env.logger.buffer';
import guid from './tools.guid';

export { LogsService, ELogLevels };

/**
 * @class
 * Logger
 */
export default class Logger {

    private _signature: string = '';
    private _parameters: LoggerParameters = new LoggerParameters({});
    private _unixtimes: { [key: string]: number } = { };

    /**
     * @constructor
     * @param {string} signature        - Signature of logger instance
     * @param {LoggerParameters} params - Logger parameters
     */
    constructor(signature: string, params?: LoggerParameters) {
        if (params instanceof LoggerParameters) {
            this._parameters = params;
        }
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

    /**
     * Publish WTF logs.
     * The thing is, if we get at least one WTF log, only WTF logs will be
     * published after.
     * It's useful for quick debug
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public wtf(...args: any[]) {
        LogsService.setGlobalLevel(ELogLevels.WTF);
        return this._log(this._getMessage(...args), ELogLevels.WTF);
    }

    public measure(operation: string): () => void {
        const id: string = guid();
        this._unixtimes[id] = Date.now();
        this.info(`starting "${operation}"`);
        return () => {
            this.info(`"${operation}" finished in: ${((Date.now() - this._unixtimes[id]) / 1000).toFixed(2)} sec`);
            delete this._unixtimes[id];
        };
    }

    private _console(message: string, level: ELogLevels) {
        if (!this._parameters.console) {
            return false;
        }
        if (LogsBuffer.isLocked()) {
            return LogsBuffer.buffer(level, message);
        }
        if (LogsService.getAllowedConsoleOutput()[level]) {
            // tslint:disable-next-line: no-console
            console.log(message);
        }
    }



    private _output(message: string) {
        if (typeof this._parameters.output === 'function') {
            this._parameters.output(message);
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
                if (index < (args.length - 1)) {
                    message = `${message},\n `;
                }
            });
        }
        return message;
    }

    private _log(message: string, level: ELogLevels) {
        LogsService.introduce();
        if (level === ELogLevels.WTF) {
            message = LogsService.getTimestamp() + 'WTF >>> ' + message;
        } else {
            message = LogsService.getTimestamp() + '[' + ' '.repeat(level.length > 7 ? 0 : (7 - level.length)) + level + ']' + '[' + this._signature + ']: ' + message;
        }
        this._console(message, level);
        this._output(message);
        LogsService.write(message);
        return message;
    }

}
