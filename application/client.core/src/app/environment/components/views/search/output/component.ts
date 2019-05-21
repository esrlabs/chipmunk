import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import { ControllerSessionTabSearchOutput, ISearchStreamPacket, IStreamState, ILoadedRange } from '../../../../controller/controller.session.tab.search.output';
import { IDataAPI, IRange, IRow, IRowsPacket, IStorageInformation } from 'logviewer-client-complex';
import { ViewSearchOutputRowComponent } from './row/component';
import ViewsEventsService from '../../../../services/standalone/service.views.events';

@Component({
    selector: 'app-views-search-output',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class ViewSearchOutputComponent implements OnDestroy, AfterViewInit, AfterContentInit {

    @Input() public session: ControllerSessionTab | undefined;

    public _ng_outputAPI: IDataAPI;

    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _output: ControllerSessionTabSearchOutput | undefined;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
        this._ng_outputAPI = {
            getComponentFactory: this._api_getComponentFactory.bind(this),
            getItemHeight: this._api_getItemHeight.bind(this),
            getRange: this._api_getRange.bind(this),
            getStorageInfo: this._api_getStorageInfo.bind(this),
            updatingDone: this._api_updatingDone.bind(this),
            onStorageUpdated: new Subject<IStorageInformation>(),
            onScrollTo: new Subject<number>(),
            onRowsDelivered: new Subject<IRowsPacket>(),
            onRedraw: new Subject<void>(),
        };
    }

    ngAfterViewInit() {
    }

    ngAfterContentInit() {
        if (this.session === undefined) {
            return;
        }
        // Get reference to stream wrapper
        this._output = this.session.getSessionSearch().getOutputStream();
        // Make subscriptions
        this._subscriptions.onStateUpdated = this._output.getObservable().onStateUpdated.subscribe(this._onStateUpdated.bind(this));
        this._subscriptions.onRangeLoaded = this._output.getObservable().onRangeLoaded.subscribe(this._onRangeLoaded.bind(this));
        this._subscriptions.onReset = this._output.getObservable().onReset.subscribe(this._onReset.bind(this));
        this._subscriptions.onScrollTo = this._output.getObservable().onScrollTo.subscribe(this._onScrollTo.bind(this));
        this._subscriptions.onResize = ViewsEventsService.getObservable().onResize.subscribe(this._onResize.bind(this));
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _api_getComponentFactory(): any {
        return ViewSearchOutputRowComponent;
    }

    private _api_getItemHeight(): number {
        return 16;
    }

    private _api_getRange(range: IRange, antiLoopCounter: number = 0): IRowsPacket {
        const rows: ISearchStreamPacket[] | Error = this._output.getRange(range);
        if (rows instanceof Error) {
            if (antiLoopCounter > 1000) {
                throw rows;
            }
            return this._api_getRange(range, antiLoopCounter + 1);
        }
        return {
            range: range,
            rows: rows
        };
    }

    private _api_getStorageInfo(): IStorageInformation {
        return {
            count: this._output.getState().count
        };
    }

    private _api_updatingDone(range: IRange): void {
        this._output.setFrame(range);
    }

    private _onReset() {
        this._ng_outputAPI.onStorageUpdated.next({
            count: 0
        });
    }

    private _onStateUpdated(state: IStreamState) {
        this._ng_outputAPI.onStorageUpdated.next({
            count: state.count
        });
    }

    private _onRangeLoaded(packet: ILoadedRange) {
        this._ng_outputAPI.onRowsDelivered.next({
            range: packet.range,
            rows: packet.rows,
        });
    }

    private _onScrollTo(row: number) {
        const closed: { row: number, index: number } = this.session.getSessionSearch().getCloseToMatch(row);
        if (closed.index === -1) {
            return;
        }
        this._ng_outputAPI.onScrollTo.next(closed.index);
    }

    private _onResize() {
        this._cdRef.detectChanges();
        this._ng_outputAPI.onRedraw.next();
    }

}
