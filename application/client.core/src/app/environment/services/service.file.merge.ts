import { Subscription, Subject, Observable } from 'rxjs';
import { Session } from '../controller/session/session';
import { CommonInterfaces } from '../interfaces/interface.common';
import { IPC } from './service.electron.ipc';
import { ControllerFileMergeSession } from '../controller/controller.file.merge.session';
import { IService } from '../interfaces/interface.service';
import { CGuids } from '../states/state.default.sidebar.apps';

import EventsSessionService from './standalone/service.events.session';
import SessionsService from './service.sessions.tabs';
import SidebarSessionsService from './service.sessions.sidebar';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IFileInfo {
    path: string;
    name: string;
    parser: string;
    preview: string;
    size: number;
}

export interface IMergeFile {
    path: string;
    info: IFileInfo;
    format: CommonInterfaces.Detect.ITimestampFormat;
}

export interface IMergeFilesService {
    add(files: IPC.IFile[], session: string): void;
    getController(session?: string): ControllerFileMergeSession | undefined;
    closeSidebarView(): void;
}

export class MergeFilesService implements IService, IMergeFilesService {
    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('MergeFilesService');
    private _controllers: Map<string, ControllerFileMergeSession> = new Map();

    constructor() {
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        this._subscriptions.onSessionClosed =
            EventsSessionService.getObservable().onSessionClosed.subscribe(
                this._onSessionClosed.bind(this),
            );
    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'MergeFilesService';
    }

    public add(files: IPC.IFile[], session: string) {
        const controller: ControllerFileMergeSession | undefined = this._controllers.get(session);
        if (controller === undefined) {
            this._logger.error(`Fail to find ControllerFileMergeSession for session: ${session}`);
            return;
        }
        controller
            .add(
                files.map((file: IPC.IFile) => {
                    return file.path;
                }),
            )
            .catch((addErr: Error) => {
                this._logger.error(
                    `Fail add files to merge controller due error: ${addErr.message}`,
                );
            });
    }

    public getController(session?: string): ControllerFileMergeSession | undefined {
        if (session === undefined) {
            const controller: Session | undefined = SessionsService.getActive();
            if (controller === undefined) {
                return undefined;
            } else {
                session = controller.getGuid();
            }
        }
        return this._controllers.get(session);
    }

    public closeSidebarView() {
        SidebarSessionsService.remove(CGuids.merging);
    }

    private _onSessionChange(session: Session | undefined) {
        if (session === undefined) {
            return;
        }
        if (this._controllers.has(session.getGuid())) {
            return;
        }
        this._controllers.set(session.getGuid(), new ControllerFileMergeSession(session.getGuid()));
    }

    private _onSessionClosed(guid: string) {
        const controller: ControllerFileMergeSession | undefined = this._controllers.get(guid);
        if (controller === undefined) {
            return;
        }
        // Destroy
        controller
            .destroy()
            .catch((destroyErr: Error) => {
                this._logger.error(
                    `Fail to destroy controller for "${guid}" due errr: ${destroyErr.message}`,
                );
            })
            .finally(() => {
                // Remove from storage
                this._controllers.delete(guid);
            });
    }
}

export default new MergeFilesService();
