import * as Toolkit from 'chipmunk.client.toolkit';
import ElectronIpcService, { IPC, Subscription } from './service.electron.ipc';
import { IService } from '../interfaces/interface.service';
import { Subject, Observable } from 'rxjs';

export type TSessionId = string;
export type TConnectionId = string;

export interface IConnection {
    id: string;
    session: string;
}

export interface IConnectEvent {
    session: string;
    id: string;
}

export interface IDisconnectEvent {
    session: string;
    id: string;
}

export class ConnectionsService implements IService {
    private _logger: Toolkit.Logger = new Toolkit.Logger('ConnectionsService');
    private _subscriptions: { [key: string]: Subscription } = {};
    private _connections: Map<TSessionId, Map<TConnectionId, IConnection>> = new Map();
    private _subjects: {
        connected: Subject<IConnectEvent>;
        disconnected: Subject<IDisconnectEvent>;
    } = {
        connected: new Subject<IConnectEvent>(),
        disconnected: new Subject<IDisconnectEvent>(),
    };

    constructor() {
        this._subscriptions.DLTDeamonDisconnectEvent = ElectronIpcService.subscribe(
            IPC.DLTDeamonDisconnectEvent,
            this._ipc_onDLTDeamonDisconnectEvent.bind(this),
        );
        this._subscriptions.DLTDeamonConnectEvent = ElectronIpcService.subscribe(
            IPC.DLTDeamonConnectEvent,
            this._ipc_onDLTDeamonConnectEvent.bind(this),
        );
    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            this._connections.clear();
            resolve();
        });
    }

    public getName(): string {
        return 'ConnectionsService';
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    public getObservable(): {
        connected: Observable<IConnectEvent>;
        disconnected: Observable<IDisconnectEvent>;
    } {
        return {
            connected: this._subjects.connected.asObservable(),
            disconnected: this._subjects.disconnected.asObservable(),
        };
    }

    public getConnection(session: string): Map<TConnectionId, IConnection> | undefined {
        return this._connections.get(session);
    }

    public hasConnection(session: string, id: TConnectionId): boolean {
        const connections: Map<string, IConnection> | undefined = this._connections.get(session);
        if (connections === undefined) {
            return false;
        }
        return connections.has(id);
    }

    private _ipc_onDLTDeamonDisconnectEvent(message: IPC.DLTDeamonDisconnectEvent) {
        const connections: Map<string, IConnection> | undefined = this._connections.get(
            message.session,
        );
        if (connections === undefined) {
            return this._subjects.disconnected.next({
                id: message.id,
                session: message.session,
            });
        }
        const connection: IConnection | undefined = connections.get(message.id);
        if (connection === undefined) {
            return this._subjects.disconnected.next({
                id: message.id,
                session: message.session,
            });
        }
        connections.delete(message.id);
        if (connections.size === 0) {
            this._connections.delete(message.session);
        } else {
            this._connections.set(message.session, connections);
        }
        this._subjects.disconnected.next({
            id: message.id,
            session: message.session,
        });
    }

    private _ipc_onDLTDeamonConnectEvent(message: IPC.DLTDeamonConnectEvent) {
        let connections: Map<string, IConnection> | undefined = this._connections.get(
            message.session,
        );
        if (connections === undefined) {
            connections = new Map();
        }
        const connection: IConnection | undefined = connections.get(message.id);
        if (connection !== undefined) {
            // Error
            return;
        }
        connections.set(message.id, {
            id: message.id,
            session: message.session,
        });
        this._connections.set(message.session, connections);
        this._subjects.connected.next({
            id: message.id,
            session: message.session,
        });
    }
}

export default new ConnectionsService();
