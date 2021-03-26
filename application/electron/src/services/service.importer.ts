import * as IScheme from './service.storage.scheme';
import * as FS from '../tools/fs';

import { StateFile } from '../classes/class.statefile';
import { IService } from '../interfaces/interface.service';
import { IPCMessages, Subscription } from './service.electron';
import { ImporterWriter } from '../controllers/importer/importer.writer';

import ServiceElectron from './service.electron';
import ServiceStreams from './service.streams';
import Logger from '../tools/env.logger';

interface IData {
    length: number;
    entities: IPCMessages.ISessionImporterData[];
}

/**
 * @class ServiceImporter
 * @description Provides access to logviewer configuration. Used on electron level
 */

class ServiceImporter implements IService {

    private _settings: StateFile<IScheme.IStorage> | undefined;
    private _logger: Logger = new Logger('ServiceImporter');
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };
    private _writer: ImporterWriter = new ImporterWriter();

    public init(): Promise<void> {
        return new Promise((resolve) => {
            // Subscribe to IPC messages / errors
            ServiceElectron.IPC.subscribe(IPCMessages.SessionImporterLoadRequest, this._ipc_onSessionImporterLoadRequest.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.SessionImporterLoadRequest = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "SessionImporterLoadRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
            });
            ServiceElectron.IPC.subscribe(IPCMessages.SessionImporterSaveRequest, this._ipc_onSessionImporterSaveRequest.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.SessionImporterSaveRequest = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "SessionImporterSaveRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
            });
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            // Unsubscribe IPC messages / events
            Object.keys(this._subscriptions).forEach((key: string) => {
                (this._subscriptions as any)[key].destroy();
            });
            this._writer.destroy().catch((err: Error) => {
                this._logger.warn(`Fail correctly destroy files writer due error: ${err.message}`);
            }).finally(resolve);
        });
    }

    public getName(): string {
        return 'ServiceImporter';
    }

    public get(): StateFile<IScheme.IStorage> {
        return this._settings as StateFile<IScheme.IStorage>;
    }

    private _ipc_onSessionImporterLoadRequest(message: IPCMessages.TMessage, response: (message: IPCMessages.TMessage) => void) {
        if (!(message instanceof IPCMessages.SessionImporterLoadRequest)) {
            return;
        }
        const file: { streamId: string, file: string, bounds: string[] } | Error = ServiceStreams.getStreamFile(message.session);
        if (file instanceof Error || file.bounds.length !== 1) {
            return response(new IPCMessages.SessionImporterLoadResponse({
                session: message.session,
            }));
        }
        const sessionFile: string = this._getImporterFileName(file.bounds[0]);
        FS.exist(sessionFile).then((exist: boolean) => {
            if (!exist) {
                return response(new IPCMessages.SessionImporterLoadResponse({
                    session: message.session,
                }));
            }
            FS.readTextFile(sessionFile).then((data: string) => {
                try {
                    const parsed: IData = JSON.parse(data);
                    if (typeof parsed !== 'object' || parsed === null || typeof parsed.length !== 'number' || !(parsed.entities instanceof Array)) {
                        return response(new IPCMessages.SessionImporterLoadResponse({
                            error: `Fail parse session file because it's invalid or not supported`,
                            session: message.session,
                        }));
                    }
                    const len: number | Error = ServiceStreams.getStreamLen(message.session);
                    if (len instanceof Error) {
                        return response(new IPCMessages.SessionImporterLoadResponse({
                            error: `Fail get length of stream`,
                            session: message.session,
                        }));
                    }
                    if (parsed.length !== len) {
                        return response(new IPCMessages.SessionImporterLoadResponse({
                            error: `Length of stored stream's data and actual stream are dismatch`,
                            session: message.session,
                        }));
                    }
                    response(new IPCMessages.SessionImporterLoadResponse({
                        data: parsed.entities,
                        session: message.session,
                    }));
                } catch (e) {
                    return response(new IPCMessages.SessionImporterLoadResponse({
                        error: `Fail parse session file due error: ${e.message}`,
                        session: message.session,
                    }));
                }
            }).catch((err: Error) => {
                return response(new IPCMessages.SessionImporterLoadResponse({
                    error: `Fail read session file due error: ${err.message}`,
                    session: message.session,
                }));
            });
        }).catch((err: Error) => {
            return response(new IPCMessages.SessionImporterLoadResponse({
                error: `Fail find session file due error: ${err.message}`,
                session: message.session,
            }));
        });
    }

    private _ipc_onSessionImporterSaveRequest(message: IPCMessages.TMessage, response: (message: IPCMessages.TMessage) => void) {
        if (!(message instanceof IPCMessages.SessionImporterSaveRequest)) {
            return;
        }
        const file: { streamId: string, file: string, bounds: string[] } | Error = ServiceStreams.getStreamFile(message.session);
        if (file instanceof Error) {
            return response(new IPCMessages.SessionImporterSaveResponse({
                error: file.message,
                session: message.session,
            }));
        }
        if (file.bounds.length !== 1) {
            return response(new IPCMessages.SessionImporterSaveResponse({
                error: `Cannot assign session with file, because it's possible only for 1 file`,
                session: message.session,
            }));
        }
        const len: number | Error = ServiceStreams.getStreamLen(message.session);
        if (len instanceof Error) {
            return response(new IPCMessages.SessionImporterSaveResponse({
                error: `Cannot get stream length`,
                session: message.session,
            }));
        }
        this._writer.write(this._getImporterFileName(file.bounds[0]), JSON.stringify({
            length: len,
            entities: message.data,
        }));
        response(new IPCMessages.SessionImporterSaveResponse({
            session: message.session,
        }));
    }

    private _getImporterFileName(filename: string): string {
        return `${filename}.chip`;
    }

}

export default (new ServiceImporter());
