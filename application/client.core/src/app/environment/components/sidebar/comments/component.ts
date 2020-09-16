import { Component, OnDestroy, Input,  ChangeDetectorRef, AfterContentInit, AfterViewInit } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { IServices } from '../../../services/shared.services.sidebar';
import { IMenuItem } from '../../../services/standalone/service.contextmenu';
import { IComment } from '../../../controller/controller.session.tab.stream.comments.types';

import EventsSessionService from '../../../services/standalone/service.events.session';
import ContextMenuService from '../../../services/standalone/service.contextmenu';
import TabsSessionsService from '../../../services/service.sessions.tabs';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-sidebar-app-files',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppCommentsComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    @Input() public services: IServices;
    @Input() public onBeforeTabRemove: Subject<void>;
    @Input() public close: () => void;

    public _ng_comments: IComment[] = [];

    private _subscriptions: { [key: string]: Subscription } = {};
    private _sessionSubs: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppMergeFilesComponent');
    private _destroyed: boolean = false;
    private _controller: ControllerSessionTab | undefined;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        Object.keys(this._sessionSubs).forEach((key: string) => {
            this._sessionSubs[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
    }

    public ngAfterViewInit() {
        this._onSessionChange(TabsSessionsService.getActive());
        this._load();
    }

    private _onSessionChange(controller: ControllerSessionTab | undefined) {
        this._controller = controller;
        Object.keys(this._sessionSubs).forEach((key: string) => {
            this._sessionSubs[key].unsubscribe();
        });
        if (this._controller !== undefined) {
            this._sessionSubs.onAdded = this._controller.getSessionComments().getObservable().onAdded.subscribe(this._onCommentAdded.bind(this));
        }
        this._load();
        this._forceUpdate();
    }

    private _load() {

        if (this._controller === undefined) {
            this._ng_comments = [];
        } else {
            this._ng_comments = Array.from(this._controller.getSessionComments().get().values());
        }
        this._forceUpdate();
    }

    private _onCommentAdded(comment: IComment) {
        this._load();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
