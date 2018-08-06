import {Component, OnInit, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, OnDestroy, EventEmitter, AfterViewChecked } from '@angular/core';
import {DomSanitizer                            } from '@angular/platform-browser';

import { ViewControllerListItem                 } from '../list/item/component';
import { LongList                               } from '../../core/components/common/long-list/component';
import { OnScrollEvent                          } from '../../core/components/common/long-list/interface.scrollevent';

import { ListItemInterface                      } from '../list/item/interface';
import { ListLineMark                           } from '../list/line/interface.mark';

import { Logs, TYPES as LogTypes                } from '../../core/modules/tools.logs';
import { events as Events                       } from '../../core/modules/controller.events';
import { configuration as Configuration         } from '../../core/modules/controller.config';

import { ViewInterface                          } from '../../core/interfaces/interface.view';
import { DataRow                                } from '../../core/interfaces/interface.data.row';
import { EVENT_DATA_IS_UPDATED                  } from '../../core/interfaces/events/DATA_IS_UPDATE';

import { TextSelection, TSelectionEvent         } from '../../core/modules/controller.selection.text';

import { Request                                } from '../../core/services/interface.request';
import { SimpleListItem                         } from '../../core/components/common/lists/simple-drop-down/item.interface';
import { ANSIClearer                            } from "../../core/modules/tools.ansiclear";
import { settings as Settings                   } from '../../core/modules/controller.settings';
import { viewsParameters                        } from '../../core/services/service.views.parameters';
import { serviceRequests                        } from '../../core/services/service.requests';
import { ViewControllerPattern                  } from "../controller.pattern";
import { ViewClass                              } from "../../core/services/class.view";
import { TopBarSearchRequest                    } from "./search.request/component";
import { MODES                                  } from '../../core/modules/controller.data.search.modes';
import { popupController                        } from "../../core/components/common/popup/controller";
import { DialogSearchRequestsPresets            } from '../../core/components/common/dialogs/seach.requests.presets/component';

import { EContextMenuItemTypes, IContextMenuItem, IContextMenuEvent } from '../../core/components/context-menu/interfaces';
import { DataFilter                             } from "../../core/interfaces/interface.data.filter";

interface ISelectedMarker {
    index: string,
    value: string
};

const SETTINGS : {
    SELECTION_OFFSET        : number,
    TEXT_SELECTED_COLOR     : string,
    TEXT_SELECTED_BACKGROUND:string
} = {
    SELECTION_OFFSET        : 3,
    TEXT_SELECTED_COLOR     : 'rgb(0,0,0)',
    TEXT_SELECTED_BACKGROUND: 'rgb(150,150,250)'
};

const FILTER_MODES = {
    ACTIVE_FROM_PASSIVE : 'ACTIVE_FROM_PASSIVE',
    ACTIVE_AND_PASSIVE  : 'ACTIVE_AND_PASSIVE',
    ONLY_ACTIVE         : 'ONLY_ACTIVE',
    ONLY_PASSIVE        : 'ONLY_PASSIVE'
};

const ON_OFF = {
    ON : 'On',
    OFF: 'Off'
};

@Component({
    selector        : 'view-controller-search-results',
    templateUrl     : './template.html',
})

export class ViewControllerSearchResults extends ViewControllerPattern implements ViewInterface, OnInit, OnDestroy, AfterViewChecked {

    public viewParams       : ViewClass             = null;

    public exportdata       : {
        url         : any,
        filename    : string
    } = {
        url         : null,
        filename    : ''
    };

    public line             : {
        visible         : boolean,
        marks           : Array<ListLineMark>,
        count           : number,
        scroll          : OnScrollEvent,
        scrollTo        : EventEmitter<number>,
        offsetTop       : number,
        offsetBottom    : number
    } = {
        visible         : false,
        marks           : [],
        count           : 0,
        scroll          : null,
        scrollTo        : new EventEmitter(),
        offsetTop       : 0,
        offsetBottom    : 16
    };

    @ViewChild(LongList) listView: LongList;
    @ViewChild ('exporturl', { read: ViewContainerRef}) exportURLNode: ViewContainerRef;

    private _rows                       : Array<any>                    = [];
    private rows                        : Array<any>                    = [];
    private maxWidthRow                 : any                           = null;
    private rowsCount                   : number                        = 0;
    private followByScroll              : boolean                       = true;
    private highlight                   : boolean                       = true;
    private activeSearchResults         : boolean                       = true;
    private resultsMap                  : {[key:number]: boolean}       = {};
    private onScrollSubscription        : EventEmitter<OnScrollEvent>   = new EventEmitter();
    private textSelection               : TextSelection                 = null;
    private textSelectionTrigger        : EventEmitter<TSelectionEvent> = new EventEmitter();
    private regsCache                   : Object                        = {};
    private requests                    : Array<Request>                = [];
    private _requests                   : Array<Request>                = [];
    private bookmarks                   :    Array<number>                 = [];
    private requestsListClosed          : boolean                       = true;
    private filterMode                  : string                        = FILTER_MODES.ACTIVE_AND_PASSIVE;
    private onOffLabel                  : string                        = ON_OFF.OFF;
    private onOffCache                  : Object                        = {};
    private shareHighlightHash          : string                        = '';
    private lastBookmarkOperation       : number                        = null;
    private highlight_search_requests   : boolean                       = false;
    private inSearch                    : boolean                       = false;

    private conditions          : Array<SimpleListItem>         = [
        { caption: 'Active from Passive',   value: FILTER_MODES.ACTIVE_FROM_PASSIVE     },
        { caption: 'Active and Passive',    value: FILTER_MODES.ACTIVE_AND_PASSIVE      },
        { caption: 'Only Active',           value: FILTER_MODES.ONLY_ACTIVE             },
        { caption: 'Only Passive',          value: FILTER_MODES.ONLY_PASSIVE            }
    ];

    private selection   : {
        own     : boolean,
        index   : number
    } = {
        own     : false,
        index   : -1
    };

    private markers     : Array<{
        value           : string,
        foregroundColor : string,
        backgroundColor : string,
        self?           : boolean
    }> = [];//Do not bind this <Marker> type, because markers view can be removed

    private reordering  : {
        dragged: number,
        dest: number,
        hash: string
    } = {
        dragged: -1,
        dest: -1,
        hash: ''
    };

    private searchNavigation : {
        prev    : symbol,
        next    : symbol
    } = {
        prev    : Symbol(),
        next    : Symbol()
    };

    constructor(
        private componentFactoryResolver    : ComponentFactoryResolver,
        private viewContainerRef            : ViewContainerRef,
        private changeDetectorRef           : ChangeDetectorRef,
        private sanitizer                   : DomSanitizer
    ){
        super();
        this.componentFactoryResolver   = componentFactoryResolver;
        this.viewContainerRef           = viewContainerRef;
        this.changeDetectorRef          = changeDetectorRef;
        this.onScroll                   = this.onScroll.            bind(this);
        this.onScrollByLine             = this.onScrollByLine.      bind(this);
        this.onTextSelection            = this.onTextSelection.     bind(this);
        this.onTabSelected              = this.onTabSelected.       bind(this);
        this.onTabDeselected            = this.onTabDeselected.     bind(this);
        this.onResizeHandle             = this.onResizeHandle.      bind(this);
        this.onConditionChanged         = this.onConditionChanged.  bind(this);
        this.onSelectAll                = this.onSelectAll.         bind(this);
        this.onDeselectAll              = this.onDeselectAll.       bind(this);
        this.onInvert                   = this.onInvert.            bind(this);
        this.onOffOn                    = this.onOffOn.             bind(this);
        this.onNumbersChange            = this.onNumbersChange.     bind(this);

        [   Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            Configuration.sets.SYSTEM_EVENTS.MARKERS_UPDATED,
            Configuration.sets.EVENTS_VIEWS.LIST_VIEW_FOLLOW_SCROLL_TRIGGER,
            Configuration.sets.EVENTS_VIEWS.LIST_VIEW_HIGHLIGHT_TRIGGER,
            Configuration.sets.EVENTS_VIEWS.LIST_VIEW_EXPORT_TO_FILE,
            Configuration.sets.SYSTEM_EVENTS.VIEW_FORCE_UPDATE_CONTENT,
            Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_BEGIN,
            Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_END,
            Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.FILTER_IS_APPLIED,
            Configuration.sets.SYSTEM_EVENTS.BOOKMARK_IS_CREATED,
            Configuration.sets.SYSTEM_EVENTS.BOOKMARK_IS_REMOVED,
            Configuration.sets.SYSTEM_EVENTS.VIEW_OUTPUT_IS_CLEARED,
            Configuration.sets.SYSTEM_EVENTS.HIGHLIGHT_SEARCH_REQUESTS_TRIGGER,
            Configuration.sets.SYSTEM_EVENTS.VISUAL_SETTINGS_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_CHANGED,
            Configuration.sets.EVENTS_VIEWS.SEARCH_VIEW_MANAGE_PRESETS,
            Configuration.sets.EVENTS_VIEWS.SEARCH_RESULT_NAVIGATION_SHOW,
            Configuration.sets.EVENTS_VIEWS.SEARCH_RESULT_NAVIGATION_HIDE].forEach((handle: string)=>{
            this['on' + handle] = this['on' + handle].bind(this);
            Events.bind(handle, this['on' + handle]);
        });
        this.onScrollSubscription.      subscribe(this.onScroll);
        this.line.scrollTo.             subscribe(this.onScrollByLine);
        this.textSelectionTrigger.      subscribe(this.onTextSelection);
        viewsParameters.onNumbersChange.subscribe(this.onNumbersChange);
        super.getEmitters().resize.subscribe(this.onResizeHandle.bind(this));
    }

    ngOnInit(){
        this.viewParams !== null && super.setGUID(this.viewParams.GUID);
        this.injectSearchBar();
        this.textSelection === null && (this.textSelection = new TextSelection(this.viewContainerRef.element.nativeElement, this.textSelectionTrigger));
        this.initRequests();
        this.initRows();
        this.activeResultsUpdateSettings();
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.MARKERS_GET_ALL, this.onMARKERS_UPDATED.bind(this));
    }

    ngOnDestroy(){
        [   Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            Configuration.sets.SYSTEM_EVENTS.MARKERS_UPDATED,
            Configuration.sets.EVENTS_VIEWS.LIST_VIEW_FOLLOW_SCROLL_TRIGGER,
            Configuration.sets.EVENTS_VIEWS.LIST_VIEW_HIGHLIGHT_TRIGGER,
            Configuration.sets.EVENTS_VIEWS.LIST_VIEW_EXPORT_TO_FILE,
            Configuration.sets.SYSTEM_EVENTS.VIEW_FORCE_UPDATE_CONTENT,
            Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_BEGIN,
            Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_END,
            Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.FILTER_IS_APPLIED,
            Configuration.sets.SYSTEM_EVENTS.BOOKMARK_IS_CREATED,
            Configuration.sets.SYSTEM_EVENTS.BOOKMARK_IS_REMOVED,
            Configuration.sets.SYSTEM_EVENTS.VIEW_OUTPUT_IS_CLEARED,
            Configuration.sets.SYSTEM_EVENTS.HIGHLIGHT_SEARCH_REQUESTS_TRIGGER,
            Configuration.sets.SYSTEM_EVENTS.VISUAL_SETTINGS_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_CHANGED,
            Configuration.sets.EVENTS_VIEWS.SEARCH_VIEW_MANAGE_PRESETS,
            Configuration.sets.EVENTS_VIEWS.SEARCH_RESULT_NAVIGATION_SHOW,
            Configuration.sets.EVENTS_VIEWS.SEARCH_RESULT_NAVIGATION_HIDE].forEach((handle: string)=>{
            Events.unbind(handle, this['on' + handle]);
        });
        this.onScrollSubscription.      unsubscribe();
        this.line.scrollTo.             unsubscribe();
        super.getEmitters().resize.     unsubscribe();
        viewsParameters.onNumbersChange.unsubscribe();
    }

    ngAfterViewChecked(){
        if (this.exportdata.url !== null && this.exportURLNode !== null){
            this.exportURLNode.element.nativeElement.click();
            this.exportdata.url         = null;
            this.exportdata.filename    = '';
        }
        super.ngAfterViewChecked();
    }

    injectSearchBar(){
        if (this.viewParams !== null) {
            Events.trigger(Configuration.sets.EVENTS_VIEWS.VIEW_BAR_INJECT_COMPONENT, this.viewParams.GUID, {
                component:TopBarSearchRequest,
                params: {},
                inputs: {}
            });
        }
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Requests functionality
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    initRequests(){
        if (serviceRequests.getActiveRequests().length === 0) {
            this.onREQUESTS_HISTORY_UPDATED(serviceRequests.getCurrentRequest(), serviceRequests.getRequests());
        } else {
            this.onREQUESTS_HISTORY_UPDATED(serviceRequests.getActiveRequests(), serviceRequests.getRequests());
        }
    }

    onBOOKMARK_IS_CREATED(index: number) {
        if (this.lastBookmarkOperation !== index) {
            this.bookmarks.indexOf(index) === -1 && this.bookmarks.push(index);
            this.updateTab();
        }
    }

    onBOOKMARK_IS_REMOVED(index: number) {
        if (this.lastBookmarkOperation !== -index) {
            this.bookmarks.indexOf(index) !== -1 && this.bookmarks.splice(this.bookmarks.indexOf(index),1);
            this.updateTab();
        }
    }

    onSEARCH_REQUEST_CHANGED(event: DataFilter){
        if (event.value !== '') {
            this.forceOnOffToOn();
            this.inSearch = true;
        } else {
            this.inSearch = false;
            let settings = Settings.get();
            settings.visual.make_filters_active_after_search_is_cleared && this.forceOnOffToOff();
        }
    }

    onREQUESTS_HISTORY_UPDATED(requests: Array<Request>, _requests: Array<Request>){
        this.requests   = requests;
        this._requests  = _requests.map((request)=>{
            request['onChangeState']        = this.onChangeState.bind(this, request.GUID);
            request['onChangeColor']        = this.onRequestColorChange.bind(this, request.GUID);
            request['onRemove']             = this.onRequestRemove.bind(this, request.GUID);
            request['onChange']             = this.onRequestChange.bind(this, request.GUID);
            request['onChangeVisibility']   = this.onChangeVisibility.bind(this, request.GUID);
            return request;
        });
        this.checkOnOffMode();
        this.dropConditionToDefault();
        this.forceUpdate();
    }

    onFILTER_IS_APPLIED(rows : Array<DataRow>){
        let measure = Logs.measure('[search.results/tab.results][onFILTER_IS_APPLIED]');
        this.resultsMap = {};
        this.dropConditionToDefault();
        this.initRows(rows);
        Logs.measure(measure);
    }

    clearHandles(request: Request){
        delete request['onChangeState'];
        delete request['onChangeColor'];
        delete request['onRemove'];
        delete request['onChange'];
        delete request['onChangeVisibility'];
        return request;
    }

    onChangeState(GUID: string, active: boolean){
        serviceRequests.updateRequests(this._requests.map((request)=>{
            GUID === request.GUID && (request.active = active);
            this.checkOnOffMode();
            return this.clearHandles(
                Object.assign({}, request)
            );
        }));
    }

    onChangeVisibility(GUID: string, visibility: boolean){
        serviceRequests.updateRequests(this._requests.map((request)=>{
            GUID === request.GUID && (request.visibility = visibility);
            return this.clearHandles(
                Object.assign({}, request)
            );
        }), true);
        this.onOffToDefault();
        this.updateVisibility();
    }

    onRequestColorChange(GUID: string, foregroundColor: string, backgroundColor: string){
        serviceRequests.updateRequests(this._requests.map((request)=>{
            GUID === request.GUID && (request.foregroundColor = foregroundColor);
            GUID === request.GUID && (request.backgroundColor = backgroundColor);
            return this.clearHandles(
                Object.assign({}, request)
            );
        }));
    }

    onRequestRemove(GUID: string){
        serviceRequests.updateRequests(this._requests.filter((request)=>{
            return GUID !== request.GUID;
        }));
    }

    onRequestChange(GUID: string, updated: string, foregroundColor: string, backgroundColor: string, type: string, passive: boolean){
        serviceRequests.updateRequests(this._requests.map((request)=>{
            if (GUID === request.GUID) {
                request.value           = updated;
                request.type            = type;
                request.passive         = passive;
                request.foregroundColor = foregroundColor;
                request.backgroundColor = backgroundColor;
            }
            return this.clearHandles(
                Object.assign({}, request)
            );
        }));
    }

    onRequestActivePassiveChange(GUID: string){
        serviceRequests.updateRequests(this._requests.map((request)=>{
            if (GUID === request.GUID) {
                request.passive = !request.passive;
            }
            return this.clearHandles(
                Object.assign({}, request)
            );
        }));
    }

    onRequestVisibilityChange(GUID: string){
        serviceRequests.updateRequests(this._requests.map((request)=>{
            if (GUID === request.GUID) {
                request.visibility = !request.visibility;
            }
            return this.clearHandles(
                Object.assign({}, request)
            );
        }));
    }

    onConditionChanged(filterMode: string){
        this.resultsMap = {};
        this.filterMode = filterMode;
        this.filterRows();
    }

    isConditionVisible(){
        let results = false;
        this._requests.forEach((request: Request) => {
           if (request.passive) {
               results = true;
           }
        });
        return results;
    }

    dropConditionToDefault(){
        if (this.isConditionVisible()) {
            return;
        }
        if (this.filterMode === FILTER_MODES.ONLY_PASSIVE || this.filterMode === FILTER_MODES.ACTIVE_FROM_PASSIVE) {
            this.filterMode = FILTER_MODES.ONLY_ACTIVE;
        }
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Request manage functions
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    onSelectAll(){
        serviceRequests.updateRequests(this._requests.map((request)=>{
            request.visibility = true;
            return this.clearHandles(
                Object.assign({}, request)
            );
        }), true);
        this.updateVisibility();
    }

    onDeselectAll(){
        serviceRequests.updateRequests(this._requests.map((request)=>{
            request.visibility = false;
            return this.clearHandles(
                Object.assign({}, request)
            );
        }), true);
        this.updateVisibility();
    }

    onInvert(){
        serviceRequests.updateRequests(this._requests.map((request)=>{
            request.visibility = !request.visibility;
            return this.clearHandles(
                Object.assign({}, request)
            );
        }), true);
        this.updateVisibility();
    }

    checkOnOffMode(){
        if (this.requests.length === 0) {
            this.onOffLabel = ON_OFF.ON;
        } else {
            this.onOffLabel = ON_OFF.OFF;
        }
    }

    onOffToDefault(){
        if (this.onOffLabel === ON_OFF.ON) {
            this.onOffLabel = ON_OFF.OFF;
        }
    }

    forceOnOffToOn(){
        if (this.onOffLabel !== ON_OFF.OFF) {
            return;
        }
        this.onOffOn(null, false);
    }

    forceOnOffToOff() {
        if (this.onOffLabel !== ON_OFF.ON) {
            return;
        }
        this.onOffOn(null, false);
    }

    onOffOn(event: MouseEvent, noChange: boolean = false){
        !noChange && (this.onOffLabel = (this.onOffLabel === ON_OFF.ON ? ON_OFF.OFF : ON_OFF.ON));
        switch (this.onOffLabel){
            case ON_OFF.OFF:
                serviceRequests.updateRequests(this._requests.map((request)=>{
                    request.visibility = this.onOffCache[request.GUID] !== void 0 ? this.onOffCache[request.GUID] : true;
                    return this.clearHandles(
                        Object.assign({}, request)
                    );
                }), true);
                this.updateVisibility();
                break;
            case ON_OFF.ON:
                this._requests.forEach((request)=>{
                    this.onOffCache[request.GUID] = request.visibility;
                });
                this.onDeselectAll();
                break;
        }
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Active results including; share highlighting in main view
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    activeResultsUpdateSettings(){
        let settings = Settings.get();
        this.activeSearchResults = settings.visual.show_active_search_results_always;
        this.highlight_search_requests = settings.visual.highlight_search_requests;
    }

    onVISUAL_SETTINGS_IS_UPDATED(){
        let settings = Settings.get();
        if (this.highlight_search_requests !== settings.visual.highlight_search_requests){
            this.shareHighlightState(true);
        }
        if (this.activeSearchResults !== settings.visual.show_active_search_results_always ||
            this.highlight_search_requests !== settings.visual.highlight_search_requests){
            this.activeResultsUpdateSettings();
            this.filterRows();
            this.forceUpdate();
        }
    }


    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Tab functions
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    onTabSelected(){
        this.forceUpdate();
        this.listView !== void 0 && this.listView.forceCalculation();
        this.listView !== void 0 && this.listView.forceUpdate();
    }

    onTabDeselected(){
    }

    onResizeHandle(){
        this.forceUpdate();
        this.listView !== void 0 && this.listView.forceCalculation();
        this.listView !== void 0 && this.listView.forceUpdate();
    }

    updateTab(){
        this.filterRows();
        this.updateRows();
        this.forceUpdate();
    }

    updateTitle(){
        //this.setLabel !== null && this.setLabel.emit(`Results${(this.rows.length > 0 ? (' (' + this.rows.length + ')') : '')}`);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Inline requests list
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    onRequestListTrigger(){
        this.requestsListClosed = !this.requestsListClosed;
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Rows stuff
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    initRows(rows : Array<DataRow> = null){
        let sources = rows instanceof Array ? rows : [];
        this._rows  = this.convertRows(sources, 0);
        this.filterRows();
        this.checkLength();
        rows instanceof Array && this.forceUpdate();
    }

    addRows(rows : Array<DataRow> = null){
        let sources     = rows instanceof Array ? rows : [],
            rowsClear   = this.convertRows(sources, this._rows.length),
            rowsFiltered= this.convertFilterRows(rowsClear, true);
        this._rows. push(...rowsClear);
        this.rows.  push(...rowsFiltered);
        this.synchCounting();
        this.shareHighlightState();
        this.setMaxWidthRow();
        this.updateTitle();
        this.checkLength();
        this.updateVisibility();
        this.forceUpdate();
    }

    convertRows(rows: Array<DataRow>, offset: number = 0){
        let markersHash = this.getMarkersHash();
        return rows.map((row, index)=>{
            let factory     = this.componentFactoryResolver.resolveComponentFactory(ViewControllerListItem),
                _index      = index + offset;
            return {
                factory : factory,
                params  : {
                    GUID            : this.viewParams !== null ? this.viewParams.GUID : null,
                    val             : row.str,
                    original        : row.str,
                    match           : row.match,
                    matchReg        : row.matchReg,
                    index           : _index,
                    selection       : this.selection.index === _index ? true : false,
                    bookmarked      : this.bookmarks.indexOf(index) !== -1,
                    visibility      : viewsParameters.numbers,
                    total_rows      : this._rows.length === 0 ? rows.length : this._rows.length,
                    markers         : this.markers,
                    markersHash     : markersHash,
                    regsCache       : this.regsCache,
                    highlight       : {
                        foregroundColor: '',
                        backgroundColor: ''
                    }
                },
                requests    : row.requests,
                match       : row.match,
                matchReg    : row.matchReg,
                callback    : this.onRowInit.bind(this, _index),
                filtered    : row.filtered !== void 0 ? row.filtered : false,
                update      : null
            };
        });
    }

    checkLength(){
        if (this._rows instanceof Array){
            if (this._rows.length.toString().length !== this.rowsCount.toString().length){
                this.rows.forEach((row)=>{
                    row.params.total_rows = this._rows.length;
                    typeof row.update === 'function' && row.update({total_rows  : this._rows.length});
                });
                this.rowsCount = this._rows.length;
            }
        }
    }

    setMaxWidthRow(){
        let _row    = '';
        let _rowOrg = '';
        this.rows.forEach((row: any) => {
            if (_row.length < row.params.original.length) {
                _row = row.params.val;
                _rowOrg = row.params.original;
            }
        });
        if (_row !== '' && (this.maxWidthRow === null || this.maxWidthRow.params.original.length < _rowOrg.length || this.maxWidthRow.count !== this.rows.length)){
            const params = {
                GUID            : this.viewParams !== null ? this.viewParams.GUID : null,
                val             : _row,
                original        : _rowOrg,
                index           : 0,
                selection       : false,
                bookmarked      : false,
                filtered        : false,
                match           : '',
                matchReg        : false,
                visibility      : true,
                total_rows      : 0,
                markers         : [] as Array<any>,
                markersHash     : '',
                regsCache       : {},
                highlight       : {
                    backgroundColor:'',
                    foregroundColor:''
                }
            };
            if (this.maxWidthRow !== null && this.maxWidthRow.update !== null) {
                this.maxWidthRow.update(params);
            } else {
                const factory = this.componentFactoryResolver.resolveComponentFactory(ViewControllerListItem);
                this.maxWidthRow = {
                    factory : factory,
                    params  : params,
                    callback        : (instance : ListItemInterface) => {
                        this.maxWidthRow.update = instance.update.bind(instance);
                    },
                    update          : null,
                    filtered        : true,
                    filters         : {},
                    match           : '',
                    matchReg        : false
                };
            }
            this.maxWidthRow.count = this.rows.length;
        }
    }

    getPassiveFilters(){
        return this.requests.filter((request: Request)=>{
            return request.passive;
        });
    }

    getActiveFilters(){
        return this.requests.filter((request: Request)=>{
            return !request.passive;
        });
    }

    getRowsByRequestsActive(rows: Array<any>, requests: Array<Request>, exp: any = {}){
        let map     = {},
            i       = 0,
            result  = [],
            measure = Logs.measure('[search.results/tab.results][getRowsByRequestsActive]');
        if (requests.length > 0){
            result = rows.filter((row, index)=>{
                let match   : {
                    match: string,
                    isReg: boolean
                } = {
                    match:'',
                    isReg: false
                };
                if (exp[index] === void 0){
                    let filtered    = false,
                        highlight   = {
                            foregroundColor: '',
                            backgroundColor: ''
                        };
                    if ((this.activeSearchResults && row.filtered) || this.bookmarks.indexOf(index) !== -1){
                        filtered = true;
                        match.match = row.match;
                        match.isReg = row.matchReg;
                    }
                    requests.forEach((request: Request)=>{
                        if (!filtered){
                            row.requests[request.GUID] && (filtered = true);
                            row.requests[request.GUID] && (highlight.foregroundColor = request.foregroundColor);
                            row.requests[request.GUID] && (highlight.backgroundColor = request.backgroundColor);
                            match.match = request.value;
                            match.isReg = request.type === MODES.REG;
                        }
                        row.requests[request.GUID] && (request.count += 1);
                    });
                    row.params.highlight    = highlight;
                    row.update !== null && row.update(row.params);
                    if (filtered){
                        row.params.matchReg = match.isReg;
                        row.params.match    = match.match;
                        row.matchReg        = match.isReg;
                        row.match           = match.match;
                        map[index] = i;
                        i += 1;
                    }
                    if (this.activeSearchResults && row.filtered){
                        row.params.active = true;
                    } else {
                        row.params.active = false;
                    }
                    return filtered;
                } else {
                    return false;
                }
            });
        }
        Logs.measure(measure);
        return {
            rows: result,
            map : map
        };
    }

    getRowsByRequestsPassive(rows: Array<any>, requests: Array<Request>, exp: any = {}){
        let map     = {},
            i       = 0,
            result  = [],
            measure = Logs.measure('[search.results/tab.results][getRowsByRequestsPassive]');
        if (requests.length > 0){
            result = rows.filter((row, index)=>{
                if (exp[index] === void 0){
                    let filtered    = false,
                        highlight   = {
                            foregroundColor: '',
                            backgroundColor: ''
                        };
                    if ((this.activeSearchResults && row.filtered) || this.bookmarks.indexOf(index) !== -1){
                        filtered = true;
                    }
                    requests.forEach((request: Request)=>{
                        if (!filtered){
                            !row.requests[request.GUID] && (filtered = true);
                            !row.requests[request.GUID] && (highlight.foregroundColor = request.foregroundColor);
                            !row.requests[request.GUID] && (highlight.backgroundColor = request.backgroundColor);
                        } else {
                            row.requests[request.GUID] && (filtered = false);
                            row.requests[request.GUID] && (highlight.foregroundColor = '');
                            row.requests[request.GUID] && (highlight.backgroundColor = '');
                        }
                        !row.requests[request.GUID] && (request.count += 1);
                    });
                    row.params.highlight    = highlight;
                    row.update !== null && row.update(row.params);
                    if (filtered){
                        map[index] = i;
                        i += 1;
                    }
                    if (this.activeSearchResults && row.filtered){
                        row.params.active = true;
                    } else {
                        row.params.active = false;
                    }
                    return filtered;
                } else {
                    return false;
                }
            });
        }
        Logs.measure(measure);
        return {
            rows: result,
            map : map
        };
    }

    convertFilterRows (rows: Array<any>, adding: boolean = false) {
        let active  : Array<Request>    = this.getActiveFilters(),
            passive : Array<Request>    = this.getPassiveFilters(),
            result  : any               = [],
            measure                     = Logs.measure('[search.results/tab.results][convertFilterRows]');
        !adding && this.resetCounts();
        if (this.inSearch) {
            result = this.getRowsByRequestsActive (rows, active, {}).rows;
        } else {
            switch (this.filterMode){
                case FILTER_MODES.ACTIVE_FROM_PASSIVE:
                    let _rows   = this.getRowsByRequestsPassive(rows, passive, {}).rows;
                    result      = this.getRowsByRequestsActive(_rows, active, {}).rows;
                    break;
                case FILTER_MODES.ACTIVE_AND_PASSIVE:
                    let _active = this.getRowsByRequestsActive  (rows, active, {});
                    let _passive= this.getRowsByRequestsPassive (rows, passive, _active.map);
                    result      = rows.filter((row, index)=>{
                        let filtered = this.activeSearchResults && row.filtered;
                        return filtered ? true : (this.bookmarks.indexOf(index) !== -1 ? true : (_active.map[index] !== void 0 ? true : (_passive.map[index] !== void 0)));
                    });
                    break;
                case FILTER_MODES.ONLY_ACTIVE:
                    result = this.getRowsByRequestsActive (rows, active, {}).rows;
                    break;
                case FILTER_MODES.ONLY_PASSIVE:
                    result = this.getRowsByRequestsPassive(rows, passive, {}).rows;
                    break;
            }
        }
        result.forEach((row: any) => {
            this.resultsMap[row.params.index] = true;
        });
        Logs.measure(measure);
        return result;
    }

    getHighlightHash(): string {
        let hash = `${this.rows.length}:${this.requests.length}:${this._requests.length}:${serviceRequests.getCurrentRequest().length}:`;
        this._requests.forEach((request: Request) => {
            hash += `${request.backgroundColor}-${request.foregroundColor}`;
        });
        return hash;
    }

    resetHighlightHash(){
        this.shareHighlightHash = '';
    }

    shareHighlightState(force: boolean = false){
        const hash = this.getHighlightHash();
        if (!force && hash === this.shareHighlightHash && !this.isOrderingChanged()) {
            return false;
        }
        const measure = Logs.measure('[search.results/tab.results][shareHighlightState]');
        this.setOrderingHash();
        this.shareHighlightHash = hash;
        let settings = Settings.get();
        let results: {[key: number]: any} = {};
        if (settings.visual.highlight_search_requests) {
            this._rows.forEach((row)=>{
                let highlight: any = {
                    foregroundColor: '',
                    backgroundColor: ''
                };
                for(let i = 0, max = this._requests.length - 1; i <= max; i += 1) {
                    if (this._requests[i].active){
                        const GUID = this._requests[i].GUID;
                        if (row.requests[GUID] === true){
                            highlight.foregroundColor = this._requests[i].foregroundColor;
                            highlight.backgroundColor = this._requests[i].backgroundColor;
                            results[row.params.index] = highlight;
                            break;
                        }
                    }
                }
            });
        }
        Logs.measure(measure);
        Events.trigger(Configuration.sets.EVENTS_VIEWS.HIGHLIGHT_SEARCH_REQUESTS_DATA, results);
    }

    onHIGHLIGHT_SEARCH_REQUESTS_TRIGGER(){
        let settings = Settings.get();
        settings.visual.highlight_search_requests = !settings.visual.highlight_search_requests;
        Settings.set(settings);
        this.shareHighlightState(true);
    }

    filterRows(){
        this.rows = this.convertFilterRows(this._rows, false);
        this.synchCounting();
        this.shareHighlightState();
        this.setMaxWidthRow();
        this.updateTitle();
        this.updateVisibility();
    }

    updateRows(){
        let markersHash = this.getMarkersHash();
        this.rows instanceof Array && (this.rows = this.rows.map((row, index)=>{
            let selection   = this.selection.index === index ? true : false,
                update      = row.params.selection !== selection ? (row.update !== null) : false;
            update = row.params.GUID !== null ? (row.update !== null) : update;
            row.params.selection        = selection;
            row.params.visibility       = viewsParameters.numbers;
            row.params.total_rows       = this._rows.length;
            row.params.GUID             = this.viewParams !== null ? this.viewParams.GUID : null;
            row.params.bookmarked       = this.bookmarks.indexOf(row.params.index) !== -1;
            row.params.markers          = this.markers;
            row.params.markersHash      = markersHash;
            row.params.match            = row.match;
            row.params.matchReg         = row.matchReg;
            update && row.update(row.params);
            return row;
        }));
        this.forceUpdate();
    }

    updateMarkersOnly(selectedMarker?: ISelectedMarker){
        let markersHash = this.getMarkersHash();
        this.rows instanceof Array && (this.rows = this.rows.map((row)=>{
            row.params.markers          = this.markers;
            row.params.markersHash      = markersHash;
            row.update !== null && row.update(row.params, selectedMarker);
            return row;
        }));
    }

    getMarkersHash(){
        let hash = '';
        this.markers instanceof Array && this.markers.forEach((marker)=>{
            hash += marker.value + marker.foregroundColor + marker.backgroundColor;
        });
        return hash;
    }

    onRowInit(index: number, instance : ListItemInterface){
        instance.selected.subscribe(this.onOwnSelected.bind(this));
        instance.bookmark.subscribe(this.toggleBookmark.bind(this));
        this._rows[index] !== void 0 && (this._rows[index].update = instance.update.bind(instance));
    }

    toggleBookmark(index : number){
        if(~this.bookmarks.indexOf(index)){
            this.onBOOKMARK_IS_REMOVED(index);
            this.lastBookmarkOperation = -index;
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.BOOKMARK_IS_REMOVED, index);
        } else {
            this.onBOOKMARK_IS_CREATED(index);
            this.lastBookmarkOperation = +index;
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.BOOKMARK_IS_CREATED, index);
        }
    }

    resetBookmarks(){
        this.bookmarks = [];
    }

    applyBookmarks(bookmarks: Array<number> = []){
        this.bookmarks = bookmarks;
    }

    onOwnSelected(index : number){
        let _index = this.getIndexInSearchList(index);
        ~_index && this.select(_index, true);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED, index);
    }

    select(index: number = -1, own: boolean = false){
        this.selection.own   = own;
        this.selection.index = index;
        this.updateRows();
    }

    synchCounting(){
        this.requests.forEach((request: Request) => {
            this._requests.forEach((_request: Request) => {
                _request.GUID === request.GUID && (_request.count = request.count);
            });
        });
    }

    resetCounts(target?: Array<Request>){
        if (target instanceof Array){
            target.forEach((request: Request) => {
                request.count = 0;
            });
        } else {
            this.requests.forEach((request: Request) => {
                request.count = 0;
            });
            this._requests.forEach((request: Request) => {
                request.count = 0;
            });
        }
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Visibility
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    getHidden(){
        const results = {};
        this._requests.forEach((request: Request) => {
            if (!request.visibility){
                results[request.GUID] = true;
            }
        });
        return results;
    }

    updateVisibility(){
        const measure = Logs.measure('[search.results/tab.results][updateVisibility]');
        let visibilityMap = {};
        this.rows = Object.keys(this.resultsMap).map((index)=>{
            return this._rows[index] !== void 0 ? this._rows[index] : null;
        }).filter((row: any) => {
            return row !== null;
        });
        if (serviceRequests.getVisibleActiveRequests().length === 0){
            const current = serviceRequests.getCurrentRequest();
            if (current.length === 0) {
                this._rows.forEach((row: any, index: number)=>{
                    if (~this.bookmarks.indexOf(index)) {
                        row.params.highlight = {
                            backgroundColor: '',
                            foregroundColor: ''
                        };
                        row.params.match = '';
                        row.params.matchReg = false;
                        row.update !== null && row.update(row.params);
                        return (visibilityMap[row.params.index] = true);
                    }
                    return false;
                });
            } else {
                this._rows.forEach((row: any, index: number)=>{
                    if (~this.bookmarks.indexOf(index) || (row.requests[current[0].GUID] !== void 0 && row.requests[current[0].GUID] === true)) {
                        row.params.highlight = {
                            backgroundColor: '',
                            foregroundColor: ''
                        };
                        row.params.match = current[0].value;
                        row.params.matchReg = current[0].type === MODES.REG;
                        row.update !== null && row.update(row.params);
                        return (visibilityMap[row.params.index] = true);
                    }
                    return false;
                });
            }
        } else {
            const hidden = this.getHidden();
            const active = serviceRequests.getActiveRequests();
            this._rows.forEach((row: any, index: number)=>{

                if (~this.bookmarks.indexOf(index) || (this.activeSearchResults && row.filtered)){
                    return (visibilityMap[row.params.index] = true);
                }

                let isIn: boolean = false;
                let before: boolean = false;
                let after: boolean = false;
                let beforeRequest: Request = null;
                let afterRequest: Request = null;

                active.forEach((request: Request) => {
                    if (!this.inSearch && this.filterMode === FILTER_MODES.ONLY_ACTIVE && request.passive) {
                        return;
                    }
                    if (!this.inSearch && this.filterMode === FILTER_MODES.ONLY_PASSIVE && !request.passive) {
                        return;
                    }
                    const GUID = request.GUID;
                    const filtered = !request.passive ? row.requests[GUID] : !row.requests[GUID];
                    if (!isIn && filtered === true && hidden[GUID] === void 0 && beforeRequest === null){
                        before = true;
                        beforeRequest = request;
                    }
                    if (filtered === true && hidden[GUID] !== void 0) {
                        isIn = true;
                    }
                    if (isIn && filtered === true && hidden[GUID] === void 0 && afterRequest === null){
                        after = true;
                        afterRequest = request;
                    }
                });

                //Row isn't filtered at all
                if (!isIn && !before && !after){
                    return false;
                }

                //Row filtered, but all filters are visible
                if (!isIn && (before || after)){
                    if (before) {
                        row.params.highlight = {
                            backgroundColor: beforeRequest.backgroundColor,
                            foregroundColor: beforeRequest.foregroundColor
                        };
                        row.params.match = beforeRequest.value;
                        row.params.matchReg = beforeRequest.type === MODES.REG;
                    } else {
                        row.params.highlight = {
                            backgroundColor: afterRequest.backgroundColor,
                            foregroundColor: afterRequest.foregroundColor
                        };
                        row.params.match = afterRequest.value;
                        row.params.matchReg = afterRequest.type === MODES.REG;
                    }
                    row.update !== null && row.update(row.params);
                    return (visibilityMap[row.params.index] = true);
                }

                //Row filtered, but filter isn't visible
                if (isIn && !before && !after){
                    return false;
                }

                //Row filtered and filter isn't visible, but it has filter before
                if (isIn && before){
                    row.params.highlight = {
                        backgroundColor: beforeRequest.backgroundColor,
                        foregroundColor: beforeRequest.foregroundColor
                    };
                    row.params.match = beforeRequest.value;
                    row.params.matchReg = beforeRequest.type === MODES.REG;
                    row.update !== null && row.update(row.params);
                    return (visibilityMap[row.params.index] = true);
                }

                //Row filtered and filter isn't visible, but it has filter after (and don't have before)
                if (isIn && !before && after){
                    row.params.highlight = {
                        backgroundColor: afterRequest.backgroundColor,
                        foregroundColor: afterRequest.foregroundColor
                    };
                    row.params.match = afterRequest.value;
                    row.params.matchReg = afterRequest.type === MODES.REG;
                    row.update !== null && row.update(row.params);
                    return (visibilityMap[row.params.index] = true);
                }
            });
        }
        this.rows = this.rows.filter((row: any) => {
            return visibilityMap[row.params.index] === true;
        });
        this.checkLength();
        this.forceUpdate();
        Logs.measure(measure);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Text selection
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    onTextSelection(event: TSelectionEvent){
        if (typeof event.text === 'string' && !~event.text.search(/\r?\n|\r/gi)){
            let index = this.getSelfMarkerIndex();
            let itemIndex = this.getSelectedItemID(event.focusNode as HTMLElement);
            if (event.text.length > 0){
                if (~index){
                    this.markers[index].value = event.text;
                } else {
                    this.markers.unshift({
                        value           : event.text,
                        backgroundColor : SETTINGS.TEXT_SELECTED_BACKGROUND,
                        foregroundColor : SETTINGS.TEXT_SELECTED_COLOR,
                        self            : true
                    });
                }
                this.updateMarkersOnly({
                    index: itemIndex,
                    value: event.text
                });
                //copyText(event.text);
            } else if (~index) {
                this.markers.splice(index, 1);
                this.updateMarkersOnly();
            }
        }
    }

    getSelfMarkerIndex(){
        let result = -1;
        this.markers.forEach((marker, index)=>{
            marker.self !== void 0 && (result = index);
        });
        return result;
    }

    getSelectedItemID(node: HTMLElement): string {
        if (typeof node === 'object' && node !== null && typeof node.nodeName === 'string') {
            if (node.nodeName === 'body'){
                return null;
            }
            if (typeof node.getAttribute === 'function') {
                let attr = node.getAttribute('data-vv-item-index');
                if (typeof attr === 'string' && attr.trim() !== ''){
                    return attr;
                }
            }
            if (node.parentNode !== void 0 && node.parentNode !== null){
                return this.getSelectedItemID(node.parentNode as HTMLElement);
            }
        }
        return null;
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Line functionality
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    updateLineScroll(event?: OnScrollEvent){
        if (event){
            this.line.scroll = event;
        } else {
            if (this.listView !== void 0 && this.listView.getScrollState !== void 0){
                this.line.scroll = this.listView.getScrollState();
            }
        }
    }

    updateLineData(){
        this.resetLineData();
        this.rows.forEach((row, index)=>{
            row.params.filtered && this.line.marks.push({
                position: index,
                color   : 'red',
                str     : row.params.val,
                onClick : this.onROW_IS_SELECTED.bind(this, index)
            });
        });
        this.line.count     = this.rows.length;
        this.line.scroll    = this.listView.getScrollState();
    }

    resetLineData(){
        this.line.count = 0;
        this.line.marks = [];
    }

    updateLine(){
        if (this.rows.length > 0 && this.highlight){
            this.updateLineData();
            this.line.visible = true;
        } else {
            this.resetLineData();
            this.line.visible = false;
        }
    }

    onScrollByLine(line: number){
        this.listView.scrollToIndex(line < 0 ? 0 : (line > (this.rows.length - 1) ? (this.rows.length - 1) : line));
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Clear view functionality
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    clearOutput(){
        this.rows       = [];
        this.rowsCount  = 0;
        this.resetCounts();
        this.forceUpdate();
    }

    onVIEW_OUTPUT_IS_CLEARED(GUID: string | symbol){
        this.clearOutput();
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Other functionality
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    forceUpdate(forceRecalculation: boolean = false){
        this.changeDetectorRef.detectChanges();
        if (this.listView !== void 0 && this.listView !== null && this.listView.update !== void 0){
            this.updateLine();
            this.listView.update(forceRecalculation);
        }
    }

    onScroll(event: OnScrollEvent){
        let settings = Settings.get();
        if (!settings.visual.use_autobottom_scroll) {
            return;
        }
        if (event.isScrolledToEnd){
            this.followByScroll = true;
        } else {
            this.followByScroll = false;
        }
        this.updateLineScroll(event);
        Events.trigger(Configuration.sets.EVENTS_VIEWS.LIST_VIEW_FOLLOW_SCROLL_SET, this.viewParams.GUID, this.followByScroll);
    }

    refreshScrollState(){
        if (this.listView !== void 0 && this.listView !== null) {
            this.onScroll(this.listView.getScrollState());
        }
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * View events listeners
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    onLIST_VIEW_FOLLOW_SCROLL_TRIGGER(GUID: string | symbol){
        if (GUID === this.viewParams.GUID){
            this.followByScroll = !this.followByScroll;
            if (this.followByScroll){
                this.onSHORTCUT_TO_END();
            }
        }
    }

    onNumbersChange(state: boolean){
        this.updateRows();
    }

    onLIST_VIEW_HIGHLIGHT_TRIGGER(GUID: string | symbol){
        if (GUID === this.viewParams.GUID){
            this.highlight = !this.highlight;
            this.filterRows();
            this.updateRows();
            this.forceUpdate();
        }
    }

    onLIST_VIEW_EXPORT_TO_FILE(GUID: string | symbol){
        if (GUID === this.viewParams.GUID){
            if (this.rows instanceof Array && this.rows.length > 0){
                let str     = this.rows.map((row)=>{
                        return ANSIClearer(row.params.original);
                    }),
                    blob    = new Blob([str.join('\n')], { type: 'text/plain; charset=ASCII' }),
                    url     = URL.createObjectURL(blob);
                this.exportdata.url         = this.sanitizer.bypassSecurityTrustUrl(url);
                this.exportdata.filename    = 'export_' + (new Date()).getTime() + '.txt';
                this.forceUpdate();
            }
        }
    }

    onSHORTCUT_TO_END(){
        if (this.rows instanceof Array && this.rows.length > 0){
            this.listView.scrollToIndex(this.rows.length - 1);
        }
    }

    onSHORTCUT_TO_BEGIN(){
        if (this.rows instanceof Array && this.rows.length > 0){
            this.listView.scrollToIndex(0);
        }
    }

    onDATA_IS_UPDATED(event : EVENT_DATA_IS_UPDATED){
        this.resetHighlightHash();
        this.resetBookmarks();
        this.refreshScrollState();
        this.applyBookmarks(event.bookmarks);
        this.resultsMap = {};
    }

    onDATA_IS_MODIFIED(event : EVENT_DATA_IS_UPDATED){
        if (event.rows instanceof Array){
            let measure = Logs.measure('[search.results/tab.results][onDATA_IS_MODIFIED]');
            this.addRows(event.rows);
            this.followByScroll && this.onSHORTCUT_TO_END();
            Logs.measure(measure);
        }
    }

    onMARKERS_UPDATED(markers: any){
        this.markers            = markers;
        this.updateMarkersOnly();
    }


    getIndexInSearchList(index: number){
        let result = -1;
        if (this.rows instanceof Array){
            for(let i = this.rows.length - 1; i >= 0; i -= 1){
                if (this.rows[i].params.index === index) {
                    result = i;
                    break;
                }
            }
        }
        return result;
    }

    onROW_IS_SELECTED(index : number){
        let _index = this.getIndexInSearchList(index);
        if (~_index && !this.selection.own && this.listView !== null && this.listView !== void 0) {
            this.listView.scrollToIndex(_index > SETTINGS.SELECTION_OFFSET ? _index - SETTINGS.SELECTION_OFFSET : _index);
            this.select(_index, false);
        } else {
            this.selection.own && (this.selection.own = false);
        }
    }


    onFilterEmmiter(state: boolean){
        if (state){
        }
    }

    onVIEW_FORCE_UPDATE_CONTENT(GUID: string | symbol){
        if (GUID === this.viewParams.GUID){
            this.forceUpdate(true);
            this.updateLineScroll();
        }
    }


    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Drag & drop requests
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    onDragInitialized(event: MouseEvent, index: number){
        this._requests.forEach((request, i) => {
            request.dragInitialized = (i === index);
        });
    }

    onRequestDragOver(event: DragEvent, index: number){
        event.preventDefault();
        event.stopPropagation();
        if (!~this.reordering.dragged){
            return false;
        }
        if (this.reordering.dragged !== index && !this._requests[index].isDragOver){
            this._requests.forEach((request, i) => {
                if (i === index) {
                    request.isDragOver = true;
                    this.reordering.dest = i;
                } else {
                    request.isDragOver = false;
                }
            });
        } else if (this.reordering.dragged === index) {
            this._requests.forEach((request) => {
                request.isDragOver = false;
            });
            this.reordering.dest = -1;
        }
    }

    onRequestLeave(event: DragEvent, index: number){
    }

    onRequestDragStart(event: DragEvent, index: number){
        if (this._requests[index] === void 0 || !this._requests[index].dragInitialized) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
        this.reordering.dragged = index;
        event.dataTransfer.setData('text/plain', 'search requests reordering');
    }

    onRequestDragEnd(event: DragEvent, index: number){
        let draggedIndex = this.reordering.dragged;
        let destIndex = this.reordering.dest;
        const dragged = this._requests[draggedIndex];
        const dest = this._requests[destIndex];

        this.reordering.dragged = -1;
        this.reordering.dest = -1;

        this._requests.forEach((request) => {
            request.isDragOver = false;
        });

        if (!~draggedIndex || !~destIndex){
            return false;
        }

        //Remove dragged
        this._requests.splice(draggedIndex, 1);
        //Insert dragged into new position
        this._requests.splice(destIndex, 0, dragged);

        serviceRequests.updateRequests(this._requests.map((request)=>{
            return this.clearHandles(
                Object.assign({}, request)
            );
        }));
    }

    getCurrentOrderingHash(): string{
        let hash = '';
        this._requests.forEach((request: Request) => {
            hash += '(' + request.type + request.value + ')';
        });
        return hash;
    }

    setOrderingHash(): void{
        this.reordering.hash = this.getCurrentOrderingHash();
    }

    isOrderingChanged(): boolean {
        return this.reordering.hash !== this.getCurrentOrderingHash();
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Context menu
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    onContextMenu(event: MouseEvent, index: number){
        let request = this._requests[index] !== void 0 ? this._requests[index] : null;
        if (request === null) {
            return;
        }
        let contextEvent = {x: event.pageX,
            y: event.pageY,
            items: [
                {
                    caption : request.visibility ? 'Hide results of request' : 'Show results of request',
                    type    : EContextMenuItemTypes.item,
                    handler : this.onChangeVisibility.bind(this, request.GUID, !request.visibility)
                },
                {
                    caption : request.active ? 'Deactivate request' : 'Activate request',
                    type    : EContextMenuItemTypes.item,
                    handler : this.onChangeState.bind(this, request.GUID, !request.active)
                },
                {
                    caption : request.passive ? 'Switch to [Active]' : 'Switch to [Passive]',
                    type    : EContextMenuItemTypes.item,
                    handler : this.onRequestActivePassiveChange.bind(this, request.GUID)
                },
                { type: EContextMenuItemTypes.divider },
                {
                    caption : 'Remove request',
                    type    : EContextMenuItemTypes.item,
                    handler : this.onRequestRemove.bind(this, request.GUID)
                }
            ]} as IContextMenuEvent;
        if (serviceRequests.hasTemporaryRequests()) {
            contextEvent.items.push(...[
                { type: EContextMenuItemTypes.divider },
                {
                    caption : 'Remove all temporary',
                    type    : EContextMenuItemTypes.item,
                    handler : this.onRemoveAllTemporary.bind(this, request.GUID)
                }
            ]);
        }
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.CONTEXT_MENU_CALL, contextEvent);
        event.preventDefault();
        event.stopPropagation();
        return false;
    }

    onContextMenuMouseDown(event: MouseEvent, index: number){
        if (window.oncontextmenu !== void 0) {
            return true;
        }
        event.which === 3 && this.onContextMenu(event, index);
    }

    onListContextMenu(event: MouseEvent) {
        let contextEvent = {x: event.pageX,
            y: event.pageY,
            items: [
                {
                    caption : 'Activate all',
                    type    : EContextMenuItemTypes.item,
                    handler : () => {
                        serviceRequests.activateAllCurrentRequests(false);
                    }
                },
                {
                    caption : 'Deactivate all',
                    type    : EContextMenuItemTypes.item,
                    handler : () => {
                        serviceRequests.deactivateAllCurrentRequests(false);
                    }
                },
                { type: EContextMenuItemTypes.divider },
                {
                    caption : 'Visible all',
                    type    : EContextMenuItemTypes.item,
                    handler : () => {
                        serviceRequests.showAllCurrentRequests(false);
                    }
                },
                {
                    caption : 'Invisible all',
                    type    : EContextMenuItemTypes.item,
                    handler : () => {
                        serviceRequests.hideAllCurrentRequests(false);
                    }
                },
                { type: EContextMenuItemTypes.divider },
                {
                    caption : 'Activate and visible all',
                    type    : EContextMenuItemTypes.item,
                    handler : () => {
                        serviceRequests.setToAllCurrentRequests({ active: true, visibility: true }, false);
                    }
                },
                {
                    caption : 'Deactivate and invisible all',
                    type    : EContextMenuItemTypes.item,
                    handler : () => {
                        serviceRequests.setToAllCurrentRequests({ active: false, visibility: false }, false);
                    }
                }
            ]} as IContextMenuEvent;
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.CONTEXT_MENU_CALL, contextEvent);
        event.preventDefault();
        event.stopPropagation();
        return false;
    }

    onRemoveAllTemporary(){
        serviceRequests.removeAllTemporary(false);
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Presets manage
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    onSEARCH_VIEW_MANAGE_PRESETS(GUID: string | symbol){
        if (GUID !== this.viewParams.GUID){
            return false;
        }
        let popupGUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogSearchRequestsPresets,
                params      : {
                    popupGUID   : popupGUID,
                    close       : () => {
                        popupController.close(popupGUID);
                    }
                }
            },
            title   : _('Manage Presets Filters'),
            settings: {
                move            : true,
                resize          : true,
                width           : '40rem',
                height          : '20rem',
                close           : false,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : popupGUID
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Navigation
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    onSEARCH_RESULT_NAVIGATION_SHOW(){
        Events.trigger(Configuration.sets.EVENTS_VIEWS.VIEW_BAR_ADD_BUTTON, this.viewParams.GUID, {
            action  : this.previousSearchNavigation.bind(this),
            hint    : _('previous'),
            icon    : 'fa-chevron-up',
            GUID    : this.searchNavigation.prev
        }, false);
        Events.trigger(Configuration.sets.EVENTS_VIEWS.VIEW_BAR_ADD_BUTTON, this.viewParams.GUID, {
            action  : this.nextSearchNavigation.bind(this),
            hint    : _('next'),
            icon    : 'fa-chevron-down',
            GUID    : this.searchNavigation.next
        }, false);
    }

    onSEARCH_RESULT_NAVIGATION_HIDE(){
        Events.trigger(Configuration.sets.EVENTS_VIEWS.VIEW_BAR_REMOVE_BUTTON, this.viewParams.GUID, this.searchNavigation.next);
        Events.trigger(Configuration.sets.EVENTS_VIEWS.VIEW_BAR_REMOVE_BUTTON, this.viewParams.GUID, this.searchNavigation.prev);
    }

    previousSearchNavigation(){
        Events.trigger(Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_PREV_IN_SEARCH);
    }

    nextSearchNavigation(){
        Events.trigger(Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_NEXT_IN_SEARCH);
    }

}
