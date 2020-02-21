import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterViewInit, ViewChild, Input, AfterContentInit, HostListener } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import { ControllerSessionTabSearchOutput, ISearchStreamPacket, IStreamState, ILoadedRange } from '../../../../controller/controller.session.tab.search.output';
import { IDataAPI, IRange, IRowsPacket, IStorageInformation, ComplexScrollBoxComponent, IScrollBoxSelection } from 'chipmunk-client-material';
import { IComponentDesc } from 'chipmunk-client-material';
import { ViewOutputRowComponent } from '../../row/component';
import { ViewSearchControlsComponent, IButton } from './controls/component';
import ViewsEventsService from '../../../../services/standalone/service.views.events';
import EventsHubService from '../../../../services/standalone/service.eventshub';
import { cleanupOutput } from '../../row/helpers';
import ContextMenuService, { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import SelectionParsersService, { ISelectionParser } from '../../../../services/standalone/service.selection.parsers';
import { FilterRequest } from '../../../../controller/controller.session.tab.search.filters.storage';

const CSettings: {
    preloadCount: number,
} = {
    preloadCount: 100
};

type TParentButtonsGetter = () => IButton[];

@Component({
    selector: 'app-views-search-output',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class ViewSearchOutputComponent implements OnDestroy, AfterViewInit, AfterContentInit {

    @ViewChild(ComplexScrollBoxComponent, {static: false}) _scrollBoxCom: ComplexScrollBoxComponent;

    @Input() public session: ControllerSessionTab | undefined;
    @Input() public onSessionChanged: Subject<ControllerSessionTab> | undefined;
    @Input() public injectionIntoTitleBar: Subject<IComponentDesc>;

    public _ng_outputAPI: IDataAPI;

    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _outputSubscriptions: { [key: string]: Subscription | undefined } = { };
    private _output: ControllerSessionTabSearchOutput | undefined;
    private _frames: Map<string, IRange> = new Map();
    private _activeSessionId: string = '';
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
            getLastFrame: this._api_getLastFrame.bind(this),
            getComponentFactory: this._api_getComponentFactory.bind(this),
            getItemHeight: this._api_getItemHeight.bind(this),
            getRange: this._api_getRange.bind(this),
            getStorageInfo: this._api_getStorageInfo.bind(this),
            updatingDone: this._api_updatingDone.bind(this),
            cleanUpClipboard: this._api_cleanUpClipboard.bind(this),
            onSourceUpdated: new Subject<void>(),
            onStorageUpdated: new Subject<IStorageInformation>(),
            onScrollTo: new Subject<number>(),
            onScrollUntil: new Subject<number>(),
            onRowsDelivered: new Subject<IRowsPacket>(),
            onRerequest: new Subject<void>(),
            onRedraw: new Subject<void>(),
        };
    }

    @HostListener('contextmenu', ['$event']) public onContexMenu(event: MouseEvent) {
        if (this._scrollBoxCom === undefined || this._scrollBoxCom === null) {
            return;
        }
        const selection: IScrollBoxSelection | undefined = this._scrollBoxCom.getSelection();
        const contextRowNumber: number = SelectionParsersService.getContextRowNumber();
        const items: IMenuItem[] = [
            {
                caption: 'Copy',
                handler: () => {
                    this._scrollBoxCom.copySelection();
                },
                disabled: selection === undefined,
            }
        ];
        if (selection === undefined) {
            window.getSelection().removeAllRanges();
        }
        if (contextRowNumber !== -1) {
            const row: ISearchStreamPacket | undefined = this._output.getRowByPosition(contextRowNumber);
            if (row !== undefined) {
                items.push(...[
                    { /* delimiter */ },
                    {
                        caption: `Show row #${contextRowNumber}`,
                        handler: () => {
                            SelectionParsersService.memo(row.str, `Row #${contextRowNumber}`);
                        },
                    },
                ]);
            }
        }
        if (selection !== undefined) {
            const parsers: ISelectionParser[] = SelectionParsersService.getParsers(selection.selection);
            if (parsers.length > 0) {
                items.push(...[
                    { /* delimiter */ },
                    ...parsers.map((parser: ISelectionParser) => {
                        return {
                            caption: parser.name,
                            handler: () => {
                                SelectionParsersService.parse(selection.selection, parser.guid, parser.name);
                            }
                        };
                    })
                ]);
            }
        }
        items.push(...[
            { /* delimiter */ },
            {
                caption: 'Search with selection',
                handler: () => {
                    const filter: FilterRequest | undefined = this._getFilterFromStr(selection.selection);
                    if (filter === undefined) {
                        return;
                    }
                    this.session.getSessionSearch().search(filter);
                },
                disabled: selection === undefined || this._getFilterFromStr(selection.selection) === undefined
            }
        ]);
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
    }

    ngAfterViewInit() {
        if (this._scrollBoxCom === undefined || this._scrollBoxCom === null) {
            return;
        }
        this._subscriptions.onScrolled = this._scrollBoxCom.getObservable().onScrolled.subscribe(this._onScrolled.bind(this));
        this._subscriptions.onKeepScrollPrevent = EventsHubService.getObservable().onKeepScrollPrevent.subscribe(this._onKeepScrollPrevent.bind(this));
        this._ng_outputAPI.onRedraw.next();
    }

    ngAfterContentInit() {
        if (this.session === undefined || this.onSessionChanged === undefined) {
            return;
        }
        this._activeSessionId = this.session.getGuid();
        // Get reference to stream wrapper
        this._output = this.session.getSessionSearch().getOutputStream();
        // Make subscriptions
        this._subscribeOutputEvents();
        this._subscriptions.onResize = ViewsEventsService.getObservable().onResize.subscribe(this._onResize.bind(this));
        this._subscriptions.onSessionChanged = this.onSessionChanged.asObservable().subscribe(this._onSessionChanged.bind(this));
        // Inject controls to caption of dock
        this._ctrl_inject();
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._unsubscribeOutputEvents();
        this._ctrl_drop();
    }

    private _subscribeOutputEvents() {
        this._outputSubscriptions.onBookmarkSelected = this.session.getSessionBooksmarks().getObservable().onSelected.subscribe(this._onScrollTo.bind(this, true));
        this._outputSubscriptions.onStateUpdated = this._output.getObservable().onStateUpdated.subscribe(this._onStateUpdated.bind(this));
        this._outputSubscriptions.onRangeLoaded = this._output.getObservable().onRangeLoaded.subscribe(this._onRangeLoaded.bind(this));
        this._outputSubscriptions.onBookmarksChanged = this._output.getObservable().onBookmarksChanged.subscribe(this._onBookmarksChanged.bind(this));
        this._outputSubscriptions.onReset = this._output.getObservable().onReset.subscribe(this._onReset.bind(this));
        this._outputSubscriptions.onScrollTo = this._output.getObservable().onScrollTo.subscribe(this._onScrollTo.bind(this, false));
    }

    private _unsubscribeOutputEvents() {
        Object.keys(this._outputSubscriptions).forEach((key: string) => {
            this._outputSubscriptions[key].unsubscribe();
        });
    }

    private _api_getComponentFactory(): any {
        return ViewOutputRowComponent;
    }

    private _api_getItemHeight(): number {
        return 16;
    }

    private _api_getLastFrame(): IRange {
        return this._output.getFrame();
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

    private _api_cleanUpClipboard(str: string): string {
        return cleanupOutput(str);
    }

    private _getFilterFromStr(str: string): FilterRequest | undefined {
        try {
            return new FilterRequest({
                request: str,
                flags: { casesensitive: true, wholeword: true, regexp: false },
            });
        } catch (e) {
            return undefined;
        }
    }

    private _onSessionChanged(session: ControllerSessionTab) {
        // Get current frame (cursor)
        const storedFrame: IRange | undefined = this._frames.get(session.getGuid());
        const frameToStore: IRange = this._output.getFrame();
        this._frames.set(this._activeSessionId, frameToStore);
        // Update session
        this._activeSessionId = session.getGuid();
        this.session = session;
        // Unsubscribe
        this._unsubscribeOutputEvents();
        // Get reference to stream wrapper
        this._output = this.session.getSessionSearch().getOutputStream();
        // Subscribe
        this._subscribeOutputEvents();
        // Update
        this._ng_outputAPI.onSourceUpdated.next();
        this._cdRef.detectChanges();
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

    private _onBookmarksChanged(rows: ISearchStreamPacket[]) {
        this._ng_outputAPI.onRerequest.next();
    }

    private _onScrollTo(bookmark: boolean, row: number) {
        if (isNaN(row) || !isFinite(row)) {
            return;
        }
        // Get nearest position
        const pos: { index: number, position: number } | undefined = this.session.getStreamMap().getClosedMatchRow(row);
        if (pos === undefined) {
            return;
        }
        // Make offset because bookmarks
        // const offset: number = this.session.getSessionBooksmarks().getNumberBookmarksBefore(pos.position);
        if (bookmark) {
            this._onKeepScrollPrevent();
        }
        this._ng_outputAPI.onScrollTo.next(pos.index);
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

    private _onResize() {
        this._cdRef.detectChanges();
        this._ng_outputAPI.onRedraw.next();
    }

    private _onKeepScrollPrevent() {
        this._controls.keepScrollDown = false;
        this._controls.update.next(this._ctrl_getButtons());
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
        }).catch((error: Error) => {
            // Do nothing, no data available
        });
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
                handler: this._ctrl_onScrollDown.bind(this),
                title: 'Scroll with updates'
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
            this._ng_outputAPI.onScrollTo.next(last);
        }
    }

}
