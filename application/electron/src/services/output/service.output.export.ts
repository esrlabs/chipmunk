import ServiceElectron, { IPCMessages } from '../service.electron';
import ServiceStreams from '../service.sessions';

import Logger from '../../tools/env.logger';

import { Subscription } from '../../tools/index';
import { IService } from '../../interfaces/interface.service';

type TActionHandler = (request: IPCMessages.OutputExportFeaturesRequest | IPCMessages.OutputExportFeatureCallRequest) => Promise<void>;

export interface IExportAction {
    caption: string;
    handler: TActionHandler;
    isEnabled: (request: IPCMessages.OutputExportFeaturesRequest) => boolean;
}

/**
 * @class ServiceOutputExport
 * @description Providers access to file parsers from render
 */

class ServiceOutputExport implements IService {

    private _logger: Logger = new Logger('ServiceOutputExport');
    private _subscription: { [key: string]: Subscription } = {};
    private _store: Map<string, Map<string, IExportAction>> = new Map();

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
            /*
            Promise.all([
                ServiceElectron.IPC.subscribe(IPCMessages.OutputExportFeaturesRequest, this._onOutputExportFeaturesRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscription.OutputExportFeaturesRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.OutputExportFeatureCallRequest, this._onOutputExportFeatureCallRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscription.OutputExportFeatureCallRequest = subscription;
                }),
            ]).then(() => {
                this._subscription.onSessionCreated = ServiceStreams.getSubjects().onSessionCreated.subscribe(this._onSessionCreated.bind(this));
                this._subscription.onSessionClosed = ServiceStreams.getSubjects().onSessionClosed.subscribe(this._onSessionClosed.bind(this));
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail to init module due error: ${error.message}`);
                reject(error);
            });
            */
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscription).forEach((key: string) => {
                this._subscription[key].destroy();
            });
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceOutputExport';
    }

    public setAction(session: string, id: string, action: IExportAction, overwrite: boolean = true): Error | undefined {
        let store: Map<string, IExportAction> | undefined = this._store.get(session);
        if (store === undefined) {
            store = new Map();
        }
        if (store.has(id)) {
            if (overwrite) {
                store.delete(id);
            } else {
                return new Error(this._logger.debug(`Action with id "${id}" is already registred for session "${session}"`));
            }
        }
        store.set(id, action);
        this._store.set(session, store);
        return undefined;
    }
/*
    private _onSessionCreated(event: INewSessionEvent) {
        if (this._store.has(event.stream.guid)) {
            return;
        }
        this._store.set(event.stream.guid, new Map());
    }
*/
    private _onSessionClosed(session: string) {
        this._store.delete(session);
    }

    private _onOutputExportFeaturesRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.OutputExportFeaturesRequest = request as IPCMessages.OutputExportFeaturesRequest;
        const store: Map<string, IExportAction> | undefined = this._store.get(req.session);
        const actions: IPCMessages.IExportAction[] = [];
        if (store !== undefined) {
            store.forEach((action: IExportAction, actionId: string) => {
                actions.push({
                    id: actionId,
                    caption: action.caption,
                    enabled: action.isEnabled(req),
                });
            });
        }
        return response(new IPCMessages.OutputExportFeaturesResponse({
            session: req.session,
            actions: actions,
        }));
    }

    private _onOutputExportFeatureCallRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        const req: IPCMessages.OutputExportFeatureCallRequest = request as IPCMessages.OutputExportFeatureCallRequest;
        const store: Map<string, IExportAction> | undefined = this._store.get(req.session);
        let action: IExportAction | undefined;
        if (store === undefined) {
            return response(new IPCMessages.OutputExportFeatureCallResponse({
                session: req.session,
                actionId: req.actionId,
                error: `No any export actions for stream "${req.session}" has been registred.`,
            }));
        }
        store.forEach((_action: IExportAction, actionId: string) => {
            if (actionId === req.actionId) {
                action = _action;
            }
        });
        if (action === undefined) {
            return response(new IPCMessages.OutputExportFeatureCallResponse({
                session: req.session,
                actionId: req.actionId,
                error: `Fail to find action "${req.actionId}" for stream "${req.session}".`,
            }));
        }
        const measure = this._logger.measure(`Running export action "${req.actionId}" for stream "${req.session}"`);
        action.handler(req).then(() => {
            measure();
            return response(new IPCMessages.OutputExportFeatureCallResponse({
                session: req.session,
                actionId: req.actionId,
            }));
        }).catch((error: Error) => {
            measure();
            response(new IPCMessages.OutputExportFeatureCallResponse({
                session: req.session,
                actionId: req.actionId,
                error: error.message,
            }));
        });
    }

}

export default (new ServiceOutputExport());
