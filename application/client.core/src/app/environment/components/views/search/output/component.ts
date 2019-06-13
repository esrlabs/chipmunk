import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import { ControllerSessionTabSearchOutput, ISearchStreamPacket, IStreamState, ILoadedRange } from '../../../../controller/controller.session.tab.search.output';
import { IDataAPI, IRange, IRowsPacket, IStorageInformation, ComplexScrollBoxComponent } from 'logviewer-client-complex';
import { IComponentDesc } from 'logviewer-client-containers';
import { ViewSearchOutputRowComponent } from './row/component';
import { ViewSearchControlsComponent, IButton } from './controls/component';
import ViewsEventsService from '../../../../services/standalone/service.views.events';

@Component({
    selector: 'app-views-search-output',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class ViewSearchOutputComponent implements OnDestroy, AfterViewInit, AfterContentInit {

    @ViewChild(ComplexScrollBoxComponent) _scrollBoxCom: ComplexScrollBoxComponent;

    @Input() public session: ControllerSessionTab | undefined;
    @Input() public injectionIntoTitleBar: Subject<IComponentDesc>;

    public _ng_outputAPI: IDataAPI;

    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _output: ControllerSessionTabSearchOutput | undefined;
    private _controls: {
        update: Subject<IButton[]>,
        keepScrollDown: boolean,
    } = {
        update: new Subject<IButton[]>(),
        keepScrollDown: true,
    };

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
            onScrollUntil: new Subject<number>(),
            onRowsDelivered: new Subject<IRowsPacket>(),
            onRerequest: new Subject<void>(),
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
        this._subscriptions.onBookmarksChanged = this._output.getObservable().onBookmarksChanged.subscribe(this._onBookmarksChanged.bind(this));
        this._subscriptions.onReset = this._output.getObservable().onReset.subscribe(this._onReset.bind(this));
        this._subscriptions.onScrollTo = this._output.getObservable().onScrollTo.subscribe(this._onScrollTo.bind(this));
        this._subscriptions.onResize = ViewsEventsService.getObservable().onResize.subscribe(this._onResize.bind(this));
        // Inject controls to caption of dock
        this._ctrl_inject();
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._ctrl_drop();
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

    private _onBookmarksChanged(rows: ISearchStreamPacket[]) {
        this._ng_outputAPI.onRerequest.next();
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

    private _ctrl_inject() {
        if (this.injectionIntoTitleBar === undefined) {
            return;
        }
        this.injectionIntoTitleBar.next({
            inputs: {
                getButtons: this._ctrl_getButtons.bind(this),
                onUpdate: this._controls.update.asObservable()
            },
            factory: ViewSearchControlsComponent,
        });
    }

    private _ctrl_drop() {
        if (this.injectionIntoTitleBar === undefined) {
            return;
        }
        this.injectionIntoTitleBar.next(undefined);
    }

    private _ctrl_getButtons(): IButton[] {
        return [
            {
                alias: 'scroll',
                icon: `small-icon-button fa-arrow-alt-circle-down ${this._controls.keepScrollDown ? 'fas' : 'far'}`,
                disabled: false,
                handler: this._ctrl_onScrollDown.bind(this)
            }
        ];
    }

    private _ctrl_onScrollDown(button: IButton) {
        this._controls.keepScrollDown = !this._controls.keepScrollDown;
        this._controls.update.next(this._ctrl_getButtons());
        if (this._scrollBoxCom === undefined || this._scrollBoxCom === null) {
            return;
        }
        const last: number = this._output.getRowsCount() - 1;
        if (this._controls.keepScrollDown && this._scrollBoxCom.getFrame().end < last) {
            this._onScrollTo(last);
        }
    }

}
