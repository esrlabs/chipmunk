import { DEFAUT_ALLOWED_CONSOLE, settings } from './settings';

/**
 * @class
 * Settings of logger
 *
 * @property {boolean} console - Show / not show logs in console
 * @property {Function} output - Sends ready string message as argument to output functions
 */

export class LoggerParameters {
    public console = true;

    private _allowedConsole?: { [key: string]: boolean } = {};

    constructor({
        console = true,
        allowedConsole = DEFAUT_ALLOWED_CONSOLE,
    }: {
        console?: boolean;
        allowedConsole?: { [key: string]: boolean };
    }) {
        this.console = console;
        this._allowedConsole = allowedConsole;
    }

    public getAllowedConsole(): { [key: string]: boolean } {
        return this._allowedConsole !== undefined
            ? this._allowedConsole
            : settings.getAllowedConsole();
    }
}
