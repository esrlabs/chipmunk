import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    ViewChild,
    ElementRef,
    AfterContentInit,
    AfterViewInit,
    ViewContainerRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { Session } from '../../../controller/session/session';
import { ControllerSessionTabTimestamp } from '../../../controller/session/dependencies/timestamps/session.dependency.timestamps';
import { DataService } from './service.data';

import TabsSessionsService from '../../../services/service.sessions.tabs';
import EventsSessionService from '../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-views-measurement',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class ViewMeasurementComponent implements OnDestroy, AfterContentInit, AfterViewInit {
    public _ng_service: DataService | undefined;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewMeasurementComponent');
    private _session: Session | undefined;
    private _destroy: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef, private _vcRef: ViewContainerRef) {}

    public ngOnDestroy() {
        this._destroy = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        if (this._ng_service !== undefined) {
            this._ng_service.destroy();
            this._ng_service = undefined;
        }
    }

    public ngAfterContentInit() {}

    public ngAfterViewInit() {
        this._ng_service = new DataService();
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        this._onSessionChange(TabsSessionsService.getActive());
    }

    public _ng_isControllerAvailable(): boolean {
        return this._session !== undefined;
    }

    public _ng_getController(): ControllerSessionTabTimestamp {
        if (this._session === undefined) {
            throw new Error(this._logger.error(`Session isn't available`));
        }
        return this._session.getTimestamp();
    }

    private _onSessionChange(controller?: Session) {
        if (controller === undefined) {
            return;
        }
        this._session = controller;
    }

    private _forceUpdate() {
        if (this._destroy) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
