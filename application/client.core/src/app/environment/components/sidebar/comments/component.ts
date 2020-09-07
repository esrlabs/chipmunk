// tslint:disable: member-ordering

declare var Electron: any;

import { Component, OnDestroy, Input,  ChangeDetectorRef, HostListener, AfterContentInit, AfterViewInit, ViewContainerRef } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { ControllerComponentsDragDropFiles } from '../../../controller/components/controller.components.dragdrop.files';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { NotificationsService, ENotificationType } from '../../../services.injectable/injectable.service.notifications';
import { IServices } from '../../../services/shared.services.sidebar';
import { ControllerFileMergeSession, IMergeFile, EViewMode } from '../../../controller/controller.file.merge.session';
import { IMenuItem } from '../../../services/standalone/service.contextmenu';
import { IPCMessages } from '../../../services/service.electron.ipc';

import EventsSessionService from '../../../services/standalone/service.events.session';
import ContextMenuService from '../../../services/standalone/service.contextmenu';

import * as Toolkit from 'chipmunk.client.toolkit';

enum EState {
    merge = 'merge',
    discover = 'discover',
    ready = 'ready',
}

@Component({
    selector: 'app-sidebar-app-files',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppCommentsComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    @Input() public services: IServices;
    @Input() public onBeforeTabRemove: Subject<void>;
    @Input() public close: () => void;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppMergeFilesComponent');
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef,
                private _notifications: NotificationsService) {
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
    }

    public ngAfterViewInit() {
    }


    private _onSessionChange(session: ControllerSessionTab | undefined) {
        if (session === undefined) {
        } else {
        }
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
