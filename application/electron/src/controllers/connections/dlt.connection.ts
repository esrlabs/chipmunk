import Logger from "../../tools/env.logger";
import ServiceStreams from "../../services/service.sessions";
import ServiceStreamSource from '../../services/service.stream.sources';
import ServiceNotifications from "../../services/service.notifications";

import { CancelablePromise } from "indexer-neon";
import { IDLTDeamonConnectionOptions as IConnectionOptions } from '../../../../common/ipc/electron.ipc.messages/dlt.deamon.recent.response';
import { EventEmitter } from 'events';

export { IConnectionOptions };

export interface IDLTOptions {
    //filters: DLT.DltFilterConf;
    stdout?: boolean;
    statusUpdates?: boolean;
}

export class DLTConnectionController extends EventEmitter {

    public static Events = {
        connect: 'connect',
        disconnect: 'disconnect',
        error: 'error',
    };

    private _connection: IConnectionOptions;
    //private _dlt: IDLTOptions;
    private _session: string;
    private _guid: string;
    private _logger: Logger;
    //private _connector: CancelablePromise<void, void, DLT.TDLTSocketEvents, DLT.TDLTSocketEventObject> | undefined;
    private _bytes: number = 0;

    constructor(guid: string, session: string, connection: IConnectionOptions, dlt?: IDLTOptions) {
        super();
        this._guid = guid;
        this._session = session;
        this._connection = connection;
        /*
        this._dlt = {
            filters: !dlt ? { min_log_level: DLT.DltLogLevel.Debug } : dlt.filters,
            // fibex: !dlt ? {fibex_file_paths: []} : dlt.fibex,
            stdout: !dlt ? false : (typeof dlt.stdout === 'boolean' ? dlt.stdout : false),
            statusUpdates: !dlt ? false : (typeof dlt.statusUpdates === 'boolean' ? dlt.statusUpdates : false),
        };*/
        this._logger = new Logger(`DLTConnectionController: ${session}`);
    }

    public destroy(): Promise<void> {
        this.removeAllListeners();
        return this.disconnect();
    }

    public connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            /*
            if (typeof this._connection.bindingAddress !== 'string' || this._connection.bindingAddress.trim() === '') {
                return reject(new Error(`bindingAddress isn't defined in options, value: ${this._connection.bindingAddress}`));
            }
            if (typeof this._connection.bindingPort !== 'string' || this._connection.bindingPort.trim() === '') {
                return reject(new Error(`bindingPort isn't defined in options, value: ${this._connection.bindingPort}`));
            }
            // Setup socket settings
            let multicast: DLT.IMulticastInfo | undefined;
            if (typeof this._connection.multicastAddress === 'string' && this._connection.multicastAddress !== '') {
                multicast = {
                    multiaddr: this._connection.multicastAddress,
                    interface: typeof this._connection.multicastInterface === 'string' ? (this._connection.multicastInterface.trim() !== '' ? this._connection.multicastInterface : undefined) : undefined,
                };
            }
            const socket: DLT.ISocketConfig = {
                bind_addr: this._connection.bindingAddress,
                port: this._connection.bindingPort,
                multicast_addr: multicast,
            };
            // Creating source alias
            const sourceName: string = `${this._connection.ecu}::${this._connection.bindingAddress}:${this._connection.bindingPort}`;
            const sourceId: number = ServiceStreamSource.add({ name: sourceName, session: this._session, meta: CMetaData });
            // Get stream file
            const streamInfo = ServiceStreams.getStreamFile(this._session);
            if (streamInfo instanceof Error) {
                return reject(streamInfo);
            }
            // Setup DLT indexer settings
            const params: DLT.IDltSocketParams = {
                filterConfig: this._dlt.filters,
                fibex: {
                    fibex_file_paths: !(this._connection.fibex instanceof Array) ? [] : this._connection.fibex.map((file) => {
                        return file.path;
                    }),
                },
                tag: `${sourceId}`,
                out: streamInfo.file,
                stdout: this._dlt.stdout as boolean,
                statusUpdates: this._dlt.statusUpdates as boolean,
            };
            // Connecting
            this._logger.info(`Connecting`);
            this._connector = indexer.dltOverSocket(this._session, params, socket).then(() => {
                this._logger.info(`Disconnected`);
            }).canceled(() => {
                this._logger.info(`Task was canceled`);
            }).catch((error: Error) => {
                this._logger.warn(`Exception: ${error.message}`);
                this.emit(DLTConnectionController.Events.error, error);
            }).finally(() => {
                this._connector = undefined;
                this.emit(DLTConnectionController.Events.disconnect);
            }).on('connect', () => {
                this.emit(DLTConnectionController.Events.connect);
            }).on('chunk', (event: Progress.IChunk) => {
                ServiceStreams.pushToStreamFileMap(streamInfo.streamId, [{
                    rows: { from: event.rowsStart, to: event.rowsEnd },
                    bytes: { from: event.bytesStart, to: event.bytesEnd },
                }]);
                this._bytes = event.bytesEnd;
            }).on('progress', (event: Progress.ITicks) => {
                // TODO: Do we need this event at all?
            }).on('notification', (event: Progress.INeonNotification) => {
                ServiceNotifications.notifyFromNeon(
                    event,
                    `DLT: ${sourceName}`,
                    this._session,
                    streamInfo.file,
                );
            });
            */
            // Resolving
            resolve();
        });
    }

    public disconnect(): Promise<void> {
        return new Promise((resolve) => {
            /*
            if (this._connector === undefined) {
                return resolve();
            }
            this._connector.finally(() => {
                resolve();
            }).abort();
            */
        });
    }

}
