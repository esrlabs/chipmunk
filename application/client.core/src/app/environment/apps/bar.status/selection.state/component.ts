import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Session } from '../../../controller/session/session';
import {
    ISelectionAccessor,
    IRange,
} from '../../../services/standalone/service.output.redirections';

import EventsSessionService from '../../../services/standalone/service.events.session';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import OutputRedirectionsService from '../../../services/standalone/service.output.redirections';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-apps-status-bar-selection-state',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class AppsStatusBarSelectionStateComponent implements OnDestroy, AfterViewInit {
    private _ranges: string[] = [];
    private _logger: Toolkit.Logger = new Toolkit.Logger('AppsStatusBarSelectionStateComponent');
    private _subscriptions: { [key: string]: Subscription } = {};
    private _sessionSubscriptions: { [key: string]: Toolkit.Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef) {}

    public ngAfterViewInit() {
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        this._subscriptions.onSessionClosed =
            EventsSessionService.getObservable().onSessionClosed.subscribe(
                this._onSessionClosed.bind(this),
            );
        const controller: Session | undefined = TabsSessionsService.getActive();
        if (controller === undefined) {
            return;
        }
        this._update([]);
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        Object.keys(this._sessionSubscriptions).forEach((key: string) => {
            this._sessionSubscriptions[key].destroy();
        });
    }

    public _ng_getRanges(): string {
        return this._ranges.join('; ');
    }

    private _onSessionChange(controller: Session | undefined) {
        if (controller === undefined) {
            return;
        }
        Object.keys(this._sessionSubscriptions).forEach((key: string) => {
            this._sessionSubscriptions[key].destroy();
        });
        this._sessionSubscriptions.onRowSelected = OutputRedirectionsService.subscribe(
            controller.getGuid(),
            this._onRowSelected.bind(this),
        );
        this._update(OutputRedirectionsService.getSelectionRanges(controller.getGuid()));
    }

    private _onSessionClosed(sessionId: string) {
        Object.keys(this._sessionSubscriptions).forEach((key: string) => {
            this._sessionSubscriptions[key].destroy();
        });
        this._update([]);
    }

    private _onRowSelected(sender: string, accessor: ISelectionAccessor, clicked: number) {
        this._update(accessor.getSelections());
    }

    private _update(selection: IRange[]) {
        this._ranges = selection.map((range: IRange) => {
            return range.start.output === range.end.output
                ? `${range.start.output}`
                : `${range.start.output}:${range.end.output}`;
        });
        this._cdRef.detectChanges();
    }
}
