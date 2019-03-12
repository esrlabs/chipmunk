import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { ControllerSessionTabStreamSearch } from '../../../controller/controller.session.tab.search.output';
import TabsSessionsService from '../../../services/service.sessions.tabs';

@Component({
    selector: 'app-views-search',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewSearchComponent implements OnDestroy, AfterViewInit, AfterContentInit {

    @ViewChild('outputviewport') _ng_outputAreaViewport: CdkVirtualScrollViewport;
    @ViewChild('outputwrapper') _ng_outputWrapperViewport: ElementRef;

    public _ng_output: ControllerSessionTabStreamSearch | undefined;

    public _ng_outputAreaSize: {
        height: number;
        width: number;
    } = {
        width: 0,
        height: 0,
    };

    private _subscriptions: { [key: string]: Subscription | undefined } = { };

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
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
        if (this._subscriptions.onSessionChange !== undefined) {
            this._subscriptions.onSessionChange.unsubscribe();
        }
        this._ng_output = session.getSessionSearch().getOutputStream();
        this._subscriptions.onSessionChange = session.getSessionStream().getObservable().next.subscribe(this._onNextStreamRow.bind(this));
    }

}
