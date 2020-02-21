import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterViewInit, ViewChild, Input, AfterContentInit } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { ControllerSessionTab, IInjectionAddEvent, IInjectionRemoveEvent } from '../../../controller/controller.session.tab';
import { ControllerSessionTabMap } from '../../../controller/controller.session.tab.map';
import { ControllerSessionTabStreamOutput, IStreamPacket, IStreamState, ILoadedRange } from '../../../controller/controller.session.tab.stream.output';
import { ControllerComponentsDragDropFiles } from '../../../controller/components/controller.components.dragdrop.files';
import { IDataAPI, IRange, IRow, IRowsPacket, IStorageInformation, DockDef, ComplexScrollBoxComponent, IScrollBoxSelection } from 'chipmunk-client-material';
import { ViewOutputRowComponent, IScope } from '../row/component';
import { ViewOutputControlsComponent, IButton } from './controls/component';
import ViewsEventsService from '../../../services/standalone/service.views.events';
import FileOpenerService, { IFile } from '../../../services/service.file.opener';
import EventsHubService from '../../../services/standalone/service.eventshub';
import { NotificationsService } from '../../../services.injectable/injectable.service.notifications';
import PluginsService from '../../../services/service.plugins';
import * as Toolkit from 'chipmunk.client.toolkit';
import { cleanupOutput } from '../row/helpers';
import ContextMenuService, { IMenuItem } from '../../../services/standalone/service.contextmenu';
import SelectionParsersService, { ISelectionParser } from '../../../services/standalone/service.selection.parsers';
import OutputExportsService, { IExportAction } from '../../../services/standalone/service.output.exports';
import { FilterRequest } from '../../../controller/controller.session.tab.search.filters.storage';

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

    @ViewChild(ComplexScrollBoxComponent, {static: false}) _scrollBoxCom: ComplexScrollBoxComponent;

    @Input() public session: ControllerSessionTab | undefined;
    @Input() public injectTitleContent: (content: DockDef.IDockTitleContent) => Error | undefined;
    @Input() public rejectTitleContent: (id: string | number) => void;

    public _ng_outputAPI: IDataAPI;
    public _ng_injections: {
        bottom: Map<string, Toolkit.IComponentInjection>,
        top: Map<string, Toolkit.IComponentInjection>,
    } = {
        bottom: new Map(),
        top: new Map(),
    };
    public _ng_mapService: ControllerSessionTabMap;

    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _output: ControllerSessionTabStreamOutput | undefined;
    private _dragdrop: ControllerComponentsDragDropFiles | undefined;
    private _destroyed: boolean = false;
    private _controls: {
        update: Subject<IButton[]>,
        keepScrollDown: boolean,
    } = {
        update: new Subject<IButton[]>(),
        keepScrollDown: true,
    };

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef,
                private _notifications: NotificationsService) {
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

    ngAfterViewInit() {
        if (this._scrollBoxCom === undefined || this._scrollBoxCom === null) {
            return;
        }
        this._subscriptions.onScrolled = this._scrollBoxCom.getObservable().onScrolled.subscribe(this._onScrolled.bind(this));
        this._subscriptions.onOffset = this._scrollBoxCom.getObservable().onOffset.subscribe(this._onOffset.bind(this));
        this._dragdrop = new ControllerComponentsDragDropFiles(this._vcRef.element.nativeElement);
        this._subscriptions.onFiles = this._dragdrop.getObservable().onFiles.subscribe(this._onFilesDropped.bind(this));
        this._subscriptions.onKeepScrollPrevent = EventsHubService.getObservable().onKeepScrollPrevent.subscribe(this._onKeepScrollPrevent.bind(this));
        // Inject controls to caption of dock
        this._ctrl_inject();
        // Set focus
        this._scrollBoxCom.setFocus();
    }

    ngAfterContentInit() {
        if (this.session === undefined) {
            return;
        }
        // Get reference to stream wrapper
        this._output = this.session.getSessionStream().getOutputStream();
        // Get injections
        this._ng_injections.bottom = this.session.getOutputInjections(Toolkit.EViewsTypes.outputBottom);
        this._ng_injections.top = this.session.getOutputInjections(Toolkit.EViewsTypes.outputTop);
        // Make subscriptions
        this._subscriptions.onStateUpdated = this._output.getObservable().onStateUpdated.subscribe(this._onStateUpdated.bind(this));
        this._subscriptions.onRangeLoaded = this._output.getObservable().onRangeLoaded.subscribe(this._onRangeLoaded.bind(this));
        this._subscriptions.onReset = this._output.getObservable().onReset.subscribe(this._onReset.bind(this));
        this._subscriptions.onScrollTo = this._output.getObservable().onScrollTo.subscribe(this._onScrollTo.bind(this));
        this._subscriptions.onResize = ViewsEventsService.getObservable().onResize.subscribe(this._onResize.bind(this));
        this._subscriptions.onOutputInjectionAdd = this.session.getObservable().onOutputInjectionAdd.subscribe(this._inj_onOutputInjectionAdd.bind(this));
        this._subscriptions.onOutputInjectionRemove = this.session.getObservable().onOutputInjectionRemove.subscribe(this._inj_onOutputInjectionRemove.bind(this));
        // Get map service
        this._ng_mapService = this.session.getStreamMap();
        // Other events
        this._subscriptions.onRepainted = this._ng_mapService.getObservable().onRepainted.subscribe(this._onResize.bind(this));
    }

    public ngOnDestroy() {
        this._destroyed = true;
        this._ctrl_reject();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        if (this._dragdrop !== undefined) {
            this._dragdrop.destroy();
        }
    }

    public _ng_onContexMenu(event: MouseEvent) {
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
            const row: IStreamPacket | undefined = this._output.getRowByPosition(contextRowNumber);
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
        OutputExportsService.getActions(this.session.getGuid()).then((actions: IExportAction[]) => {
            if (actions.length > 0) {
                items.push(...[
                    { /* delimiter */ },
                    ...actions.map((action: IExportAction) => {
                        return {
                            caption: action.caption,
                            handler: action.caller
                        };
                    })
                ]);
            }
            ContextMenuService.show({
                items: items,
                x: event.pageX,
                y: event.pageY,
            });
        }).catch((err: Error) => {
            ContextMenuService.show({
                items: items,
                x: event.pageX,
                y: event.pageY,
            });
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
        this._forceUpdate();
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

    private _onOffset(offset: number) {
        this._output.setHorScrollOffset(offset);
    }

    private _onFilesDropped(files: IFile[]) {
        FileOpenerService.open(files);
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
        if (this.injectTitleContent === undefined) {
            return;
        }
        this.injectTitleContent({
            id: this.session.getGuid(),
            component: {
                inputs: {
                    getButtons: this._ctrl_getButtons.bind(this),
                    onUpdate: this._controls.update.asObservable()
                },
                factory: ViewOutputControlsComponent,
            },
        });
    }

    private _ctrl_reject() {
        if (this.rejectTitleContent === undefined) {
            return;
        }
        this.rejectTitleContent(this.session.getGuid());
    }

    private _ctrl_getButtons(): IButton[] {
        return [
            {
                alias: 'clean',
                icon: `small-icon-button fas fa-eraser`,
                disabled: false,
                handler: this._ctrl_onCleanOutput.bind(this)
            },
            {
                alias: 'scroll',
                icon: `small-icon-button fa-arrow-alt-circle-down ${this._controls.keepScrollDown ? 'fas' : 'far'}`,
                disabled: false,
                handler: this._ctrl_onScrollDown.bind(this)
            },
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

    private _ctrl_onCleanOutput(button: IButton) {
        if (this.session === undefined) {
            return;
        }
        this.session.resetSessionContent().catch((error: Error) => {
            return this._notifications.add({
                caption: 'Session',
                message: `Fail to reset session due error: ${error.message}`
            });
        });
    }

    private _getInjections(type: Toolkit.EViewsTypes): Map<string, Toolkit.IComponentInjection> | undefined {
        let injections: Map<string, Toolkit.IComponentInjection> | undefined;
        switch (type) {
            case Toolkit.EViewsTypes.outputTop:
                injections = this._ng_injections.top;
                break;
            case Toolkit.EViewsTypes.outputBottom:
                injections = this._ng_injections.bottom;
                break;
        }
        return injections;
    }

    private _inj_onOutputInjectionAdd(event: IInjectionAddEvent) {
        // Get injections storage
        const injections: Map<string, Toolkit.IComponentInjection> | undefined = this._getInjections(event.type);
        if (injections === undefined) {
            return false;
        }
        // Check is injection already exist
        if (injections.has(event.injection.id)) {
            return;
        }
        // Check factory
        if (typeof event.injection.factory.name === 'string') {
            // This reference to component, but not factory of it (check plugins)
            const factory = PluginsService.getStoredFactoryByName(event.injection.factory.name);
            if (factory !== undefined) {
                event.injection.factory = factory;
                event.injection.resolved = true;
            } else {
                event.injection.resolved = false;
            }
        } else {
            // Will try to use as it is
            event.injection.resolved = false;
        }
        if (event.injection.factory === undefined) {
            return;
        }
        // Add new injection
        injections.set(event.injection.id, event.injection);
        this._forceUpdate();
    }

    private _inj_onOutputInjectionRemove(event: IInjectionRemoveEvent) {
        // Get injections storage
        const injections: Map<string, Toolkit.IComponentInjection> | undefined = this._getInjections(event.type);
        if (injections === undefined) {
            return false;
        }
        // Check is injection already exist
        if (!injections.has(event.id)) {
            return;
        }
        injections.delete(event.id);
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
