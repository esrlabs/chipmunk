import { Level } from './levels';
import { state } from './state';

export type LoggerConstructor<T extends Logger> = new (signature: string, ...args: any[]) => T;

const LEFT_SPACE_ON_LOGGER_SIG = 1;
const RIGHT_SPACE_ON_LOGGER_SIG = 1;
const LOG_LEVEL_MAX = 7;
const MAX_LOG_MESSAGE_LEN = 1000;

declare const console: {
    log(...args: any[]): void;
};

declare const process: {
    stdout: {
        write(buffer: string): void;
    };
};

export abstract class Logger {
    static post(msg: string, level: Level): void {
        if (console !== undefined && console !== null && typeof console.log === 'function') {
            console.log(
                `%c${msg}`,
                (() => {
                    switch (level) {
                        case Level.VERBOS:
                        case Level.WTF:
                            return 'color: grey';
                        case Level.INFO:
                            return 'color: blue';
                        case Level.DEBUG:
                            return 'color: green';
                        case Level.WARNING:
                            return 'color: darkorange';
                        case Level.ERROR:
                            return 'color: red';
                        default:
                            return '';
                    }
                })(),
            );
            if (level === Level.ERROR) {
                try {
                    throw new Error(`Error stack`);
                } catch (err) {
                    const stack = (err as Error).stack;
                    if (typeof stack === 'string') {
                        (err as Error).stack = stack
                            .split(/[\n\r]/gi)
                            .filter((s) => s.search(/\s*at Logger/g) === -1)
                            .join('\n');
                        console.log(err);
                    }
                }
            }
        } else if (
            process !== undefined &&
            process !== null &&
            process.stdout !== undefined &&
            typeof process.stdout.write === 'function'
        ) {
            process.stdout.write(msg);
        }
    }
    protected signature: string;

    public static maxNameLength = 0;

    public abstract store(msg: string, level: Level): void;

    /**
     * @constructor
     * @param {string} signature        - Signature of logger instance
     * @param {LoggerParameters} params - Logger parameters
     */
    constructor(signature: string) {
        if (signature.length > Logger.maxNameLength) {
            Logger.maxNameLength = signature.length;
        }
        this.signature = `${' '.repeat(LEFT_SPACE_ON_LOGGER_SIG)}${signature}${' '.repeat(
            RIGHT_SPACE_ON_LOGGER_SIG,
        )}`;
    }

    public rename(signature: string): void {
        this.signature = `${' '.repeat(LEFT_SPACE_ON_LOGGER_SIG)}${signature}${' '.repeat(
            RIGHT_SPACE_ON_LOGGER_SIG,
        )}`;
    }

    /**
     * Publish info logs
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public info(...args: unknown[]) {
        return this.log(this.msg(...args), Level.INFO);
    }

    /**
     * Publish warnings logs
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public warn(...args: unknown[]) {
        return this.log(this.msg(...args), Level.WARNING);
    }

    /**
     * Publish verbose logs
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public verbose(...args: unknown[]) {
        return this.log(this.msg(...args), Level.VERBOS);
    }

    /**
     * Publish error logs
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public error(...args: unknown[]) {
        return this.log(this.msg(...args), Level.ERROR);
    }

    /**
     * Publish debug logs
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public debug(...args: unknown[]) {
        return this.log(this.msg(...args), Level.DEBUG);
    }

    /**
     * Publish WTF logs. As soon as at least 1 WTF log was published
     * all others logs would not be published any more. WTF logs allows
     * developer to get clean logs for debugging
     * @param {any} args - Any input for logs
     * @returns {string} - Formatted log-string
     */
    public wtf(...args: unknown[]) {
        return this.log(this.msg(...args), Level.WTF);
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

    public push(msgs: { msg: string; level: Level }[]): void {
        msgs.forEach((msg) => {
            this.publish(msg.msg, msg.level);
        });
    }

    public publish(msg: string, level: Level): Logger {
        const defaultsLoggerInUse =
            typeof (this as any).isDefault === 'function' ? (this as any).isDefault() : false;
        if (defaultsLoggerInUse) {
            // With default logger we do not post any logs. As soon as logger will be setup
            // all collected messages will be passed into regular logger (see "scope" module)
            return this;
        }
        if (!state.isWritable(level)) {
            return this;
        }
        Logger.post(msg, level);
        return this;
    }

    protected msg(...args: unknown[]) {
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

    protected time(): string {
        const time: Date = new Date();
        return `${time.toJSON()}`;
    }

    protected log(original: string, level: Level) {
        const cut = (msg: string): string => {
            if (msg.length < MAX_LOG_MESSAGE_LEN) {
                return msg;
            }
            return `${msg.substring(0, MAX_LOG_MESSAGE_LEN)}(...cut...)${msg.substring(
                msg.length - 20,
                msg.length,
            )}`;
        };
        if (level === Level.WTF) {
            state.setDebugging(true);
        }
        if (state.isDebugging() && level !== Level.WTF) {
            return original;
        }
        const levelStr = `${level}`;
        const fill = LOG_LEVEL_MAX - levelStr.length;
        const message = `[${this.time()}][${levelStr}${' '.repeat(
            fill > 0 && isFinite(fill) && !isNaN(fill) ? fill : 0,
        )}][${this.signature}]: ${cut(original)}`;
        this.publish(message, level).store(message, level);
        return original;
    }
}
