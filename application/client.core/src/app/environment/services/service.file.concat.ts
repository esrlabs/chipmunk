import { Subscription, Subject, Observable } from 'rxjs';
import { ControllerSessionTab } from '../controller/controller.session.tab';
import { IFile } from './service.file.opener';
import { ControllerFileConcatSession } from '../controller/controller.file.concat.session';
import { IService } from '../interfaces/interface.service';
import { CGuids } from '../states/state.default.sidebar.apps';

import EventsSessionService from './standalone/service.events.session';
import SessionsService from './service.sessions.tabs';
import SidebarSessionsService from './service.sessions.sidebar';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IConcatFilesService {
    add(files: IFile[], session: string): void;
    getController(session?: string): ControllerFileConcatSession | undefined;
    closeSidebarView(): void;
}

export class ConcatFilesService implements IService, IConcatFilesService {

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ConcatFilesService');
    private _controllers: Map<string, ControllerFileConcatSession> = new Map();

    constructor() {
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._subscriptions.onSessionClosed = EventsSessionService.getObservable().onSessionClosed.subscribe(this._onSessionClosed.bind(this));
    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'ConcatFilesService';
    }

    public add(files: IFile[], session: string) {
        const controller: ControllerFileConcatSession | undefined = this._controllers.get(session);
        if (controller === undefined) {
            return this._logger.error(`Fail to find ControllerFileConcatSession for session: ${session}`);
        }
        controller.add(files.map((file: IFile) => {
            return file.path;
        })).catch((addErr: Error) => {
            this._logger.error(`Fail add files to merge controller due error: ${addErr.message}`);
        });
    }

    public getController(session?: string): ControllerFileConcatSession | undefined {
        if (session === undefined) {
            const controller: ControllerSessionTab | undefined = SessionsService.getActive();
            if (controller === undefined) {
                return undefined;
            } else {
                session = controller.getGuid();
            }
        }
        return this._controllers.get(session);
    }

    public closeSidebarView() {
        SidebarSessionsService.remove(CGuids.concat);
    }

    private _onSessionChange(session: ControllerSessionTab | undefined) {
        if (session === undefined) {
            return;
        }
        if (this._controllers.has(session.getGuid())) {
            return;
        }
        this._controllers.set(session.getGuid(), new ControllerFileConcatSession(session.getGuid()));
    }

    private _onSessionClosed(guid: string) {
        const controller: ControllerFileConcatSession | undefined = this._controllers.get(guid);
        if (controller === undefined) {
            return;
        }
        // Destroy
        controller.destroy().catch((destroyErr: Error) => {
            this._logger.error(`Fail to destroy controller for "${guid}" due errr: ${destroyErr.message}`);
        }).finally(() => {
            // Remove from storage
            this._controllers.delete(guid);
        });
    }

}

export default (new ConcatFilesService());
