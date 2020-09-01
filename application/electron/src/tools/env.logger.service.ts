import { LogsBlackbox } from "./env.logger.blackbox";
import LogsBuffer from "./env.logger.buffer";

export enum ELogLevels {
    INFO = "INFO",
    DEBUG = "DEBUG",
    WARNING = "WARNING",
    VERBOS = "VERBOS",
    ERROR = "ERROR",
    ENV = "ENV",
    WTF = "WTF",
}

export const DEFAUT_ALLOWED_CONSOLE = {
    DEBUG: true,
    ENV: true,
    ERROR: true,
    INFO: true,
    VERBOS: false,
    WARNING: true,
    WTF: true,
};

export const LOGS_LEVEL_TABLE = {
    VERBOS: [
        ELogLevels.ENV,
        ELogLevels.VERBOS,
        ELogLevels.DEBUG,
        ELogLevels.INFO,
        ELogLevels.WARNING,
        ELogLevels.ERROR,
    ],
    ENV: [ELogLevels.ENV, ELogLevels.DEBUG, ELogLevels.INFO, ELogLevels.WARNING, ELogLevels.ERROR],
    DEBUG: [ELogLevels.DEBUG, ELogLevels.INFO, ELogLevels.WARNING, ELogLevels.ERROR],
    INFO: [ELogLevels.INFO, ELogLevels.WARNING, ELogLevels.ERROR],
    WARNING: [ELogLevels.WARNING, ELogLevels.ERROR],
    WARN: [ELogLevels.WARNING, ELogLevels.ERROR],
    ERROR: [ELogLevels.ERROR],
    WTF: [ELogLevels.WTF, ELogLevels.ERROR],
};

export const LOGS_LEVEL_TABLE_ALIASES = {
    ENV: ELogLevels.ENV,
    EN: ELogLevels.ENV,
    VERBOSE: ELogLevels.VERBOS,
    VERBOS: ELogLevels.VERBOS,
    VERB: ELogLevels.VERBOS,
    VER: ELogLevels.VERBOS,
    V: ELogLevels.VERBOS,
    DEBUG: ELogLevels.DEBUG,
    DEB: ELogLevels.DEBUG,
    D: ELogLevels.DEBUG,
    INFO: ELogLevels.INFO,
    INF: ELogLevels.INFO,
    I: ELogLevels.INFO,
    WARNING: ELogLevels.WARNING,
    WARN: ELogLevels.WARNING,
    WAR: ELogLevels.WARNING,
    W: ELogLevels.WARNING,
    ERROR: ELogLevels.ERROR,
    ERR: ELogLevels.ERROR,
    E: ELogLevels.ERROR,
    WTF: ELogLevels.WTF,
};

export type TOutputFunc = (...args: any[]) => any;

class Service {
    private _level: ELogLevels | undefined;
    private _introduced: boolean = false;
    private _lasttimestamp: number = 0;
    private _blackbox: LogsBlackbox = new LogsBlackbox();
    private _stored: Map<string, string> = new Map();

    public introduce() {
        if (this._introduced) {
            return;
        }
        this._introduced = true;
        const msg: string = `\n${"-".repeat(30)}\nChipmunk session is started at: ${new Date().toISOString()}\n${"-".repeat(30)}`;
        LogsBuffer.buffer(
            ELogLevels.INFO,
            msg,
        );
        this.write(msg, ELogLevels.INFO);
    }

    public setGlobalLevel(lev: any) {
        lev = this.getLogLevelFromStr(lev);
        if (lev === undefined) {
            lev = ELogLevels.VERBOS;
        }
        this._level = lev;
        const msg: string = `${"-".repeat(30)}\nGlobal loglevel is set to: ${lev}\n${"-".repeat(30)}`;
        LogsBuffer.buffer(
            ELogLevels.INFO,
            msg,
        );
        LogsBuffer.apply(this.getAllowedConsoleOutput());
        this.write(msg, ELogLevels.INFO);
    }

    public isGlobalSet(): boolean {
        return this._level !== undefined;
    }

    public getAllowedConsoleOutput(): { [key: string]: boolean } {
        if (this._level === undefined) {
            return DEFAUT_ALLOWED_CONSOLE;
        }
        const level: ELogLevels = this._level;
        const allowed: { [key: string]: boolean } = {};
        const table = (LOGS_LEVEL_TABLE as any)[level];
        Object.keys(LOGS_LEVEL_TABLE).forEach((key: string) => {
            allowed[key] = table.indexOf(key) !== -1;
        });
        return allowed;
    }

    public isValidLevel(level: string): boolean {
        return this.getLogLevelFromStr(level) !== undefined;
    }

    public getLogLevelFromStr(str: string): ELogLevels | undefined {
        if (typeof str !== "string") {
            return undefined;
        }
        str = str.toUpperCase();
        if ((LOGS_LEVEL_TABLE_ALIASES as any)[str] === undefined) {
            return undefined;
        }
        return (LOGS_LEVEL_TABLE_ALIASES as any)[str];
    }

    public getTimestamp(): string {
        if (this._lasttimestamp === 0) {
            this._lasttimestamp = Date.now();
        }
        const now: number = Date.now();
        const diff: number = now - this._lasttimestamp;
        const diffStr: string = (diff > 0 ? "+" : diff === 0 ? "" : "-") + diff + "ms";
        const stamp: string =
            (new Date(now)).toISOString() +
            " [" +
            " ".repeat(diffStr.length > 8 ? 0 : 8 - diffStr.length) +
            diffStr +
            "]";
        this._lasttimestamp = now;
        return stamp;
    }

    public write(msg: string, level: ELogLevels | undefined) {
        if (level === ELogLevels.ENV) {
            return;
        }
        this._blackbox.write(msg);
    }

    public shutdown(): Promise<void> {
        return new Promise((resolve) => {
            this._blackbox.shutdown().then(() => {
                resolve();
            }).catch((err: Error) => {
                // tslint:disable-next-line:no-console
                console.log(`Fail to shutdown logger due error: ${err.message}`);
                resolve();
            });
        });
    }

    public store(key: string, msg: string) {
        if (typeof key !== 'string' || key.trim() === '' || typeof msg !== 'string' || msg.trim() === '') {
            return;
        }
        const stored: string | undefined = this._stored.get(key);
        this._stored.set(key, (stored !== undefined ? stored : '') + msg);
    }

    public getStored(key: string): string {
        const stored: string | undefined = this._stored.get(key);
        return stored === undefined ? '' : stored;
    }

    public strToLogLevel(level: string): ELogLevels {
        if ((LOGS_LEVEL_TABLE_ALIASES as any)[level] === undefined) {
            return ELogLevels.WARNING;
        } else {
            return (LOGS_LEVEL_TABLE_ALIASES as any)[level];
        }
    }
}

export default new Service();
