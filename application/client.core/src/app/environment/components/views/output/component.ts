import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { ControllerSessionTab, IComponentInjection } from '../../../controller/controller.session.tab';
import { ControllerSessionTabStreamOutput, IStreamPacket, IStreamState, ILoadedRange } from '../../../controller/controller.session.tab.stream.output';
import { IDataAPI, IRange, IRow, IRowsPacket, IStorageInformation, DockDef, ComplexScrollBoxComponent } from 'logviewer-client-complex';
import { ViewOutputRowComponent } from './row/component';
import { ViewOutputControlsComponent, IButton } from './controls/component';
import ViewsEventsService from '../../../services/standalone/service.views.events';

const CSettings: {
    preloadCount: number,
} = {
    preloadCount: 100
};

@Component({
    selector: 'app-views-output',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class ViewOutputComponent implements OnDestroy, AfterViewInit, AfterContentInit {

    @ViewChild(ComplexScrollBoxComponent) _scrollBoxCom: ComplexScrollBoxComponent;

    @Input() public session: ControllerSessionTab | undefined;
    @Input() public injectTitleContent: (content: DockDef.IDockTitleContent) => Error | undefined;
    @Input() public rejectTitleContent: (id: string | number) => void;

    public _ng_outputAPI: IDataAPI;
    public _ng_injections: {
        bottom: Map<string, IComponentInjection>,
    } = {
        bottom: new Map()
    };
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _output: ControllerSessionTabStreamOutput | undefined;
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
        if (this._scrollBoxCom === undefined || this._scrollBoxCom === null) {
            return;
        }
        this._subscriptions.onScrolled = this._scrollBoxCom.getObservable().onScrolled.subscribe(this._onScrolled.bind(this));
    }

    ngAfterContentInit() {
        if (this.session === undefined) {
            return;
        }
        // Get reference to stream wrapper
        this._output = this.session.getSessionStream().getOutputStream();
        // Get injections
        this._ng_injections.bottom = this.session.getOutputBottomInjections();
        // Make subscriptions
        this._subscriptions.onStateUpdated = this._output.getObservable().onStateUpdated.subscribe(this._onStateUpdated.bind(this));
        this._subscriptions.onRangeLoaded = this._output.getObservable().onRangeLoaded.subscribe(this._onRangeLoaded.bind(this));
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
    }

    private _api_getComponentFactory(): any {
        return ViewOutputRowComponent;
    }

    private _api_getItemHeight(): number {
        return 16;
    }

    private _api_getRange(range: IRange, antiLoopCounter: number = 0): IRowsPacket {
        const rows: IStreamPacket[] | Error = this._output.getRange(range);
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
        this._keepScrollDown();
    }

    private _onRangeLoaded(packet: ILoadedRange) {
        this._ng_outputAPI.onRowsDelivered.next({
            range: packet.range,
            rows: packet.rows,
        });
    }

    private _onScrollTo(row: number) {
        this._ng_outputAPI.onScrollTo.next(row);
    }

    private _onResize() {
        this._cdRef.detectChanges();
        this._ng_outputAPI.onRedraw.next();
    }

    private _onScrolled(range: IRange) {
        const last: number = this._output.getRowsCount() - 1;
        if (range.end === last && !this._controls.keepScrollDown) {
            this._controls.keepScrollDown = true;
            this._controls.update.next(this._ctrl_getButtons());
        } else if (range.end < last && this._controls.keepScrollDown) {
            this._controls.keepScrollDown = false;
            this._controls.update.next(this._ctrl_getButtons());
        }
    }

    private _keepScrollDown() {
        if (this._scrollBoxCom === undefined || this._scrollBoxCom === null) {
            return;
        }
        if (!this._controls.keepScrollDown) {
            return;
        }
        const last: number = this._output.getRowsCount() - 1;
        const range: IRange = {
            start: last - CSettings.preloadCount < 0 ? 0 : (last - CSettings.preloadCount),
            end: last
        };
        const frame: IRange = this._scrollBoxCom.getFrame();
        if (frame.end === range.end) {
            return;
        }
        this._output.preload(range).then((loaded: IRange | null) => {
            if (loaded === null) {
                // Already some request is in progress: do nothing
                return;
            }
            this._ng_outputAPI.onScrollUntil.next(loaded.end);
            // Repeat request to be sure - user at the end
            /*
            setTimeout(() => {
                this._keepScrollDown();
            }, 50);
            */
        }).catch((error: Error) => {
            // Do nothing, no data available
        });
    }

    private _ctrl_inject() {
        if (this.injectTitleContent === undefined) {
            return;
        }
        this.injectTitleContent({
            id: 'controls',
            component: {
                inputs: {
                    getButtons: this._ctrl_getButtons.bind(this),
                    onUpdate: this._controls.update.asObservable()
                },
                factory: ViewOutputControlsComponent,
            },
        });
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
