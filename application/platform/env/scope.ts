import { Transport } from '../ipc/transport';
import { LoggerConstructor, Logger } from '../log';
import { DefaultLogger } from '../log/defaults';

export class Scope {
    private _transport: Transport | undefined;
    private _logger: LoggerConstructor<any> | undefined;

    public setTransport(transport: Transport) {
        if (this._transport !== undefined) {
            throw new Error(`Transport can be setup only once`);
        }
        if (this._logger !== undefined) {
            new this._logger('@platform').debug(`IPC transport is up`);
        }
        this._transport = transport;
    }

    public getTransport(): Transport {
        if (this._transport === undefined) {
            throw new Error(`Transport isn't setup`);
        }
        return this._transport;
    }

    public setLogger(logger: LoggerConstructor<any>) {
        this._logger = logger;
        const regular: Logger = new this._logger('@platform').debug(`logger is up`);
        const collected = DefaultLogger.getCollectedMessages();
        collected.length !== 0 && regular.push(collected);
    }

    public getLogger(alias: string): Logger {
        if (this._logger === undefined) {
            return new DefaultLogger(alias);
        } else {
            return new this._logger(alias);
        }
    }
}

export const scope = new Scope();
