import {
    Component,
    OnDestroy,
    Input,
    ChangeDetectorRef,
    AfterContentInit,
    AfterViewInit,
    ChangeDetectionStrategy,
    ViewEncapsulation,
} from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { Session } from '../../../controller/session/session';
import { IServices } from '../../../services/shared.services.sidebar';
import { IComment } from '../../../controller/session/dependencies/comments/session.dependency.comments.types';
import { CShortColors } from '../../../conts/colors';

import EventsSessionService from '../../../services/standalone/service.events.session';
import TabsSessionsService from '../../../services/service.sessions.tabs';

import * as Toolkit from 'chipmunk.client.toolkit';

export enum ECommentsOrdering {
    position = 'position',
    colors = 'colors',
}

@Component({
    selector: 'app-sidebar-app-comments',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarAppCommentsComponent implements OnDestroy, AfterContentInit, AfterViewInit {
    @Input() public services!: IServices;
    @Input() public onBeforeTabRemove!: Subject<void>;
    @Input() public close!: () => void;

    public _ng_comments: IComment[] = [];
    public _ng_hidden: Array<{ count: number; color: string | undefined }> = [];
    public _ng_controller: Session | undefined;
    public _ng_broadcastEditorUsage: Subject<string> = new Subject<string>();
    public _ng_colors: string[] = CShortColors.slice();
    public _ng_ordring: ECommentsOrdering = ECommentsOrdering.position;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _sessionSubs: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppCommentsComponent');
    private _filter: string | undefined;
    private _destroyed: boolean = false;
    private _comments: IComment[] = [];

    constructor(private _cdRef: ChangeDetectorRef) {}

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
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
    }

    public ngAfterViewInit() {
        this._onSessionChange(TabsSessionsService.getActive());
        this._load();
    }

    public ngOnSetFilter(color: string | undefined) {
        this._filter = color;
        this._update();
    }

    public ngOnRemoveAll() {
        this._ng_controller !== undefined && this._ng_controller.getSessionComments().clear();
    }

    public ngOnOrderingSwitch() {
        this._ng_ordring =
            this._ng_ordring === ECommentsOrdering.colors
                ? ECommentsOrdering.position
                : ECommentsOrdering.colors;
        this._load();
    }

    public _update() {
        this._ng_comments = this._comments
            .filter((c) => this._filter === undefined || this._filter === c.color)
            .map((c) => Object.assign({}, c));
        this._ng_hidden = [];
        this._comments
            .filter((c) => this._filter !== undefined && this._filter !== c.color)
            .map((comment: IComment) => {
                const index: number = this._ng_hidden.findIndex((d) => d.color === comment.color);
                if (index === -1) {
                    this._ng_hidden.push({ count: 1, color: comment.color });
                } else {
                    this._ng_hidden[index].count += 1;
                }
            });
        this._forceUpdate();
    }

    private _onSessionChange(controller: Session | undefined) {
        this._ng_controller = controller;
        Object.keys(this._sessionSubs).forEach((key: string) => {
            this._sessionSubs[key].unsubscribe();
        });
        if (this._ng_controller !== undefined) {
            this._sessionSubs.onAdded = this._ng_controller
                .getSessionComments()
                .getObservable()
                .onAdded.subscribe(this._onCommentAdded.bind(this));
            this._sessionSubs.onUpdated = this._ng_controller
                .getSessionComments()
                .getObservable()
                .onUpdated.subscribe(this._onCommentUpdated.bind(this));
            this._sessionSubs.onRemoved = this._ng_controller
                .getSessionComments()
                .getObservable()
                .onRemoved.subscribe(this._onCommentRemoved.bind(this));
        }
        this._load();
    }

    private _load() {
        if (this._ng_controller === undefined) {
            this._comments = [];
        } else {
            let comments: IComment[] = [];
            const all: IComment[] = Array.from(
                this._ng_controller.getSessionComments().get().values(),
            );
            switch (this._ng_ordring) {
                case ECommentsOrdering.colors:
                    (CShortColors.slice() as Array<string | undefined>)
                        .concat([undefined] as Array<string | undefined>)
                        .forEach((color: string | undefined) => {
                            const group: IComment[] = all.filter((c) => c.color === color);
                            group.sort((a: IComment, b: IComment) => {
                                return a.selection.start.position > b.selection.start.position
                                    ? 1
                                    : -1;
                            });
                            comments = comments.concat(group);
                        });
                    break;
                case ECommentsOrdering.position:
                    all.sort((a: IComment, b: IComment) => {
                        return a.selection.start.position > b.selection.start.position ? 1 : -1;
                    });
                    comments = all;
                    break;
            }
            this._comments = comments;
        }
        this._update();
    }

    private _onCommentAdded(comment: IComment) {
        this._load();
    }

    private _onCommentUpdated(comment: IComment) {
        this._load();
    }

    private _onCommentRemoved(guid: string) {
        this._load();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
