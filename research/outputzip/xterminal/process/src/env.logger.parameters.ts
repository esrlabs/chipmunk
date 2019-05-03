const DEFAUT_ALLOWED_CONSOLE = {
    DEBUG: true,
    ENV: true,
    ERROR: true,
    INFO: true,
    VERBOS: false,
    WARNING: true,
};

export type TOutputFunc = (...args: any[]) => any;

/**
 * @class
 * Settings of logger
 *
 * @property {boolean} console - Show / not show logs in console
 * @property {Function} output - Sends ready string message as argument to output functions
 */

export class LoggerParameters {

    public console: boolean = true;
    public allowedConsole: {[key: string]: boolean} = {};
    public output: TOutputFunc | null = null;

    constructor(
        {
            console         = true,
            output          = null,
            allowedConsole  = DEFAUT_ALLOWED_CONSOLE,
        }: {
            console?: boolean,
            output?: TOutputFunc | null,
            allowedConsole?: {[key: string]: boolean },
        }) {
        this.console = console;
        this.output = output;
        this.allowedConsole = allowedConsole;
    }
}
