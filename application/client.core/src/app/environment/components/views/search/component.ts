import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { ControllerSessionTabSearch } from '../../../controller/controller.session.tab.search';
import { ControllerSessionTabStreamSearch } from '../../../controller/controller.session.tab.search.output';
import { NotificationsService } from '../../../services.injectable/injectable.service.notifications';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import ElectronIpcService, { IPCMessages } from '../../../services/service.electron.ipc';
import * as Toolkit from 'logviewer.client.toolkit';

@Component({
    selector: 'app-views-search',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewSearchComponent implements OnDestroy, AfterViewInit, AfterContentInit {

    @ViewChild('outputviewport') _ng_outputAreaViewport: CdkVirtualScrollViewport;
    @ViewChild('outputwrapper') _ng_outputWrapperViewport: ElementRef;
    @ViewChild('requestinput') _ng_input: ElementRef;

    public _ng_output: ControllerSessionTabStreamSearch | undefined;
    public _ng_working: boolean = false;
    public _ng_isRequestValid: boolean = true;
    public _ng_outputAreaSize: {
        height: number;
        width: number;
    } = {
        width: 0,
        height: 0,
    };

    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription | undefined } = { };
    private _session: ControllerSessionTabSearch | undefined;
    private _requestId: string | undefined;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef,
                private _notifications: NotificationsService) {
        this._subscriptions.currentSession = TabsSessionsService.getCurrentSessionObservable().subscribe(this._onSessionChange.bind(this));
        this._setActiveSession();
    }

    ngAfterViewInit() {
        this._updateOutputContainerSize();
    }

    ngAfterContentInit() {

    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_getOutputAreaStyle(): { [key: string]: string | number } {
        return {
            'width': `${this._ng_outputAreaSize.width}px`,
            'height': `${this._ng_outputAreaSize.height}px`,
        };
    }

    public _ng_onBrowserWindowResize() {
        this._updateOutputContainerSize();
    }

    public _ng_onKeyUp(event: KeyboardEvent) {
        if (this._ng_working) {
            return;
        }
        const value: string = (event.target as HTMLInputElement).value;
        this._ng_isRequestValid = Toolkit.regTools.isRegStrValid(value);
        this._cdRef.detectChanges();
        if (event.key !== 'Enter') {
            return;
        }
        this._ng_output.clearStream();
        if (value.trim() === '') {
            return this._cdRef.detectChanges();
        }
        if (!this._ng_isRequestValid) {
            return this._notifications.add({
                caption: 'Search',
                message: `Regular expresion isn't valid. Please correct it.`
            });
        }
        this._ng_working = true;
        this._requestId = Toolkit.guid();
        // Sending search request
        this._session.search([Toolkit.regTools.createFromStr(value, 'gim') as RegExp]).then((requestId: string) => {
            this._ng_working = false;
            this._cdRef.detectChanges();
        }).catch((error: Error) => {
            this._ng_working = false;
            this._cdRef.detectChanges();
            return this._notifications.add({
                caption: 'Search',
                message: `Cannot to do due error: ${error.message}.`
            });
        });
        (event.target as HTMLInputElement).value = '';
        this._cdRef.detectChanges();
    }

    private _updateOutputContainerSize() {
        if (this._vcRef === null || this._vcRef === undefined) {
            return;
        }
        const size = this._ng_outputWrapperViewport.nativeElement.getBoundingClientRect();
        this._ng_outputAreaSize.width = size.width;
        this._ng_outputAreaSize.height = size.height;
        this._cdRef.detectChanges();
        this._ng_outputAreaViewport.checkViewportSize();
    }

    private _onNextStreamRow() {
        if (this._vcRef === null || this._vcRef === undefined) {
            return;
        }
        this._ng_outputAreaViewport.scrollTo({bottom: 0});
    }

    private _onSessionChange(session: ControllerSessionTab) {
        this._setActiveSession(session);
    }

    private _setActiveSession(session?: ControllerSessionTab) {
        if (session === undefined) {
            session = TabsSessionsService.getActive();
        }
        if (session === undefined) {
            return;
        }
        this._session = session.getSessionSearch();
        if (this._subscriptions.onSessionChange !== undefined) {
            this._subscriptions.onSessionChange.unsubscribe();
        }
        this._ng_output = this._session.getOutputStream();
        this._subscriptions.onSessionChange = this._session.getObservable().next.subscribe(this._onNextStreamRow.bind(this));
    }



}
