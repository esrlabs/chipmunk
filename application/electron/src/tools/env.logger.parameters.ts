import {
    TOutputFunc,
    ELogLevels,
} from './env.logger.service';

import LogsService from './env.logger.service';

export { ELogLevels, LogsService };

/**
 * @class
 * Settings of logger
 *
 * @property {boolean} console - Show / not show logs in console
 * @property {Function} output - Sends ready string message as argument to output functions
 */

export class LoggerParameters {

    public console: boolean = true;
    public output: TOutputFunc | null = null;

    constructor(
        {
            console         = true,
            output          = null,
        }: {
            console?: boolean,
            output?: TOutputFunc | null,
        }) {
        this.console = console;
        this.output = output;
    }
}
