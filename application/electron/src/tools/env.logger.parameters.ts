export enum ELogLevels {
    INFO = 'INFO',
    DEBUG = 'DEBUG',
    WARNING = 'WARNING',
    VERBOS = 'VERBOS',
    ERROR = 'ERROR',
    ENV = 'ENV',
    WTF = 'WTF',
}

const DEFAUT_ALLOWED_CONSOLE = {
    DEBUG: true,
    ENV: true,
    ERROR: true,
    INFO: true,
    VERBOS: false,
    WARNING: true,
    WTF: true,
};

const LOGS_LEVEL_TABLE = {
    ENV: [ELogLevels.ENV, ELogLevels.VERBOS, ELogLevels.DEBUG, ELogLevels.INFO, ELogLevels.WARNING, ELogLevels.ERROR],
    VERBOS: [ELogLevels.VERBOS, ELogLevels.DEBUG, ELogLevels.INFO, ELogLevels.WARNING, ELogLevels.ERROR],
    DEBUG: [ELogLevels.DEBUG, ELogLevels.INFO, ELogLevels.WARNING, ELogLevels.ERROR],
    INFO: [ELogLevels.INFO, ELogLevels.WARNING, ELogLevels.ERROR],
    WARNING: [ELogLevels.WARNING, ELogLevels.ERROR],
    ERROR: [ELogLevels.ERROR],
    WTF: [ELogLevels.WTF, ELogLevels.ERROR],
};

type TOutputFunc = (...args: any[]) => any;

let level: ELogLevels | undefined;

export function setGlobalLogLevel(lev: ELogLevels) {
    if (typeof lev !== 'string') {
        return;
    }
    if (LOGS_LEVEL_TABLE[lev] === undefined) {
        return;
    }
    level = lev;
}

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
        if (level !== undefined && LOGS_LEVEL_TABLE[level] !== undefined) {
            Object.keys(this.allowedConsole).forEach((key: string) => {
                if (level === undefined) {
                    return;
                }
                this.allowedConsole[key] = LOGS_LEVEL_TABLE[level].indexOf(key as ELogLevels) !== -1;

            });
        }
    }
}
