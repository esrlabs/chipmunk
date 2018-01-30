import {Component, OnInit, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, OnDestroy, EventEmitter, AfterViewChecked } from '@angular/core';
import {DomSanitizer                            } from '@angular/platform-browser';

import { ViewControllerListItem                 } from '../../list/item/component';
import { LongList                               } from '../../../core/components/common/long-list/component';
import { OnScrollEvent                          } from '../../../core/components/common/long-list/interface.scrollevent';

import { ListItemInterface                      } from '../../list/item/interface';
import { ListLineMark                           } from '../../list/line/interface.mark';

import { Logs, TYPES as LogTypes                } from '../../../core/modules/tools.logs';
import { events as Events                       } from '../../../core/modules/controller.events';
import { configuration as Configuration         } from '../../../core/modules/controller.config';

import { ViewInterface                          } from '../../../core/interfaces/interface.view';
import { DataRow                                } from '../../../core/interfaces/interface.data.row';
import { EVENT_DATA_IS_UPDATED                  } from '../../../core/interfaces/events/DATA_IS_UPDATE';

import { TextSelection                          } from '../../../core/modules/controller.selection.text';
import { TabController                          } from '../../../core/components/common/tabs/tab/class.tab.controller';

import { Request                                } from '../tab.requests/request/interface.request';
import { SimpleListItem                         } from '../../../core/components/common/lists/simple-drop-down/item.interface';
import { ANSIClearer                            } from "../../../core/modules/tools.ansiclear";

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
    selector        : 'tab-search-results',
    templateUrl     : './template.html',
})

export class TabControllerSearchResults extends TabController implements ViewInterface, OnInit, OnDestroy, AfterViewChecked {

    public exportdata       : {
        url         : any,
        filename    : string
    } = {
        url         : null,
        filename    : ''
    };

    public line : {
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

    private _rows               : Array<any>                    = [];
    private rows                : Array<any>                    = [];
    private rowsCount           : number                        = 0;
    private numbers             : boolean                       = true;
    private followByScroll      : boolean                       = true;
    private highlight           : boolean                       = true;
    private onScrollSubscription: EventEmitter<OnScrollEvent>   = new EventEmitter();
    private textSelection       : TextSelection                 = null;
    private textSelectionTrigger: EventEmitter<string>          = new EventEmitter();
    private regsCache           : Object                        = {};
    private requests            : Array<Request>                = [];
    private _requests           : Array<Request>                = [];
    private bookmarks           : Array<number>                 = [];
    private requestsListClosed  : boolean                       = true;
    private filterMode          : string                        = FILTER_MODES.ACTIVE_AND_PASSIVE;
    private onOffLabel          : string                        = ON_OFF.OFF;
    private onOffCache          : Object                        = {};

    private conditions          : Array<SimpleListItem>         = [
        { caption: 'Active from Passive',   value: FILTER_MODES.ACTIVE_FROM_PASSIVE     },
        { caption: 'Active and Passive',    value: FILTER_MODES.ACTIVE_AND_PASSIVE      },
        { caption: 'Only Active',           value: FILTER_MODES.ONLY_ACTIVE             },
        { caption: 'Only Passive',          value: FILTER_MODES.ONLY_PASSIVE            }
    ];
    private lastBookmarkOperation   : number                       = null;

    private selection : {
        own     : boolean,
        index   : number
    } = {
        own     : false,
        index   : -1
    };

    private clearFunctionality : {
        button : symbol,
        inited : boolean
    } = {
        button : Symbol(),
        inited : false
    };

    private markers : Array<{
        value           : string,
        foregroundColor : string,
        backgroundColor : string,
        self?           : boolean
    }> = [];//Do not bind this <Marker> type, because markers view can be removed
    private markerSelectMode : string = 'words';

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
        [   Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            Configuration.sets.SYSTEM_EVENTS.MARKERS_UPDATED,
            Configuration.sets.EVENTS_VIEWS.LIST_VIEW_NUMERIC_TRIGGER,
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
            Configuration.sets.SYSTEM_EVENTS.VIEW_OUTPUT_IS_CLEARED].forEach((handle: string)=>{
            this['on' + handle] = this['on' + handle].bind(this);
            Events.bind(handle, this['on' + handle]);
        });
        this.onScrollSubscription.  subscribe(this.onScroll);
        this.line.scrollTo.         subscribe(this.onScrollByLine);
        this.textSelectionTrigger.  subscribe(this.onTextSelection);
        this.initRequests();
        this.initRows();
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.MARKERS_GET_ALL, this.onMARKERS_UPDATED.bind(this));
    }

    ngOnInit(){
        this.textSelection === null && (this.textSelection = new TextSelection(this.viewContainerRef.element.nativeElement, this.textSelectionTrigger));
        this.onSelect   .subscribe(this.onTabSelected);
        this.onDeselect .subscribe(this.onTabDeselected);
        this.onResize   .subscribe(this.onResizeHandle);
    }

    ngOnDestroy(){
        [   Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            Configuration.sets.SYSTEM_EVENTS.MARKERS_UPDATED,
            Configuration.sets.EVENTS_VIEWS.LIST_VIEW_NUMERIC_TRIGGER,
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
            Configuration.sets.SYSTEM_EVENTS.VIEW_OUTPUT_IS_CLEARED].forEach((handle: string)=>{
            Events.unbind(handle, this['on' + handle]);
        });
        this.onScrollSubscription.  unsubscribe();
        this.line.scrollTo.         unsubscribe();
        this.onSelect.              unsubscribe();
        this.onDeselect.            unsubscribe();
        this.onResize.              unsubscribe();
    }

    ngAfterViewChecked(){
        if (this.exportdata.url !== null && this.exportURLNode !== null){
            this.exportURLNode.element.nativeElement.click();
            this.exportdata.url         = null;
            this.exportdata.filename    = '';
        }
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Requests functionality
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    initRequests(){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_GET_ALL, this.onREQUESTS_HISTORY_UPDATED.bind(this));
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

    onREQUESTS_HISTORY_UPDATED(requests: Array<Request>, _requests: Array<Request>){
        this.requests   = requests;
        this._requests  = _requests.map((request)=>{
            request['onChangeState']    = this.onChangeState.bind(this, request.GUID);
            request['onChangeColor']    = this.onRequestColorChange.bind(this, request.GUID);
            request['onRemove']         = this.onRequestRemove.bind(this, request.GUID);
            request['onChange']         = this.onRequestChange.bind(this, request.GUID);
            return request;
        });
        this.forceUpdate();
    }

    onFILTER_IS_APPLIED(rows : Array<DataRow>){
        let measure = Logs.measure('[search.results/tab.results][onFILTER_IS_APPLIED]');
        this.initRows(rows);
        Logs.measure(measure);
    }

    clearHandles(request: Request){
        delete request['onChangeState'];
        delete request['onChangeColor'];
        delete request['onRemove'];
        delete request['onChange'];
        return request;
    }

    onChangeState(GUID: string, active: boolean){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED_OUTSIDE, this._requests.map((request)=>{
            GUID === request.GUID && (request.active = active);
            return this.clearHandles(
                Object.assign({}, request)
            );
        }));
    }

    onRequestColorChange(GUID: string, foregroundColor: string, backgroundColor: string){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED_OUTSIDE, this._requests.map((request)=>{
            GUID === request.GUID && (request.foregroundColor = foregroundColor);
            GUID === request.GUID && (request.backgroundColor = backgroundColor);
            return this.clearHandles(
                Object.assign({}, request)
            );
        }));
    }

    onRequestRemove(GUID: string){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED_OUTSIDE, this._requests.filter((request)=>{
            return GUID !== request.GUID;
        }));
    }

    onRequestChange(GUID: string, updated: string, foregroundColor: string, backgroundColor: string, type: string, passive: boolean){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED_OUTSIDE, this._requests.map((request)=>{
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

    onConditionChanged(filterMdoe: string){
        this.filterMode = filterMdoe;
        this.filterRows();
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Request manage functions
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    onSelectAll(){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED_OUTSIDE, this._requests.map((request)=>{
            request.active = true;
            return this.clearHandles(
                Object.assign({}, request)
            );
        }));
    }

    onDeselectAll(){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED_OUTSIDE, this._requests.map((request)=>{
            request.active = false;
            return this.clearHandles(
                Object.assign({}, request)
            );
        }));
    }

    onInvert(){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED_OUTSIDE, this._requests.map((request)=>{
            request.active = !request.active;
            return this.clearHandles(
                Object.assign({}, request)
            );
        }));
    }

    onOffOn(){
        this.onOffLabel = this.onOffLabel === ON_OFF.ON ? ON_OFF.OFF : ON_OFF.ON;
        switch (this.onOffLabel){
            case ON_OFF.OFF:
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED_OUTSIDE, this._requests.map((request)=>{
                    request.active = this.onOffCache[request.GUID] !== void 0 ? this.onOffCache[request.GUID] : true;
                    return this.clearHandles(
                        Object.assign({}, request)
                    );
                }));
                break;
            case ON_OFF.ON:
                this._requests.forEach((request)=>{
                    this.onOffCache[request.GUID] = request.active;
                });
                this.onDeselectAll();
                break;
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
        this.setLabel !== null && this.setLabel.emit(`Results${(this.rows.length > 0 ? (' (' + this.rows.length + ')') : '')}`);
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
        this.updateTitle();
        this.checkLength();
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
                    index           : _index,
                    selection       : this.selection.index === _index ? true : false,
                    bookmarked      : this.bookmarks.indexOf(index) !== -1,
                    visibility      : this.numbers,
                    total_rows      : this._rows.length === 0 ? rows.length : this._rows.length,
                    markers         : this.markers,
                    markersHash     : markersHash,
                    markerSelectMode: this.markerSelectMode,
                    regsCache       : this.regsCache,
                    highlight       : {
                        foregroundColor: '',
                        backgroundColor: ''
                    }
                },
                requests: row.requests,
                callback: this.onRowInit.bind(this, _index),
                update  : null
            };
        });
    }

    checkLength(){
        if (this.rows instanceof Array){
            if (this.rows.length.toString().length !== this.rowsCount.toString().length){
                this.rows.forEach((row)=>{
                    row.params.total_rows = this._rows.length;
                    typeof row.update === 'function' && row.update({total_rows  : this._rows.length});
                });
                this.rowsCount = this.rows.length;
            }
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

    getRowsByRequestsActive(rows: Array<any>, requests: Array<Request>, exp: any = {}, adding: boolean = false){
        let map     = {},
            i       = 0,
            result  = [],
            measure = Logs.measure('[search.results/tab.results][getRowsByRequestsActive]');
        if (requests.length > 0){
            if (!adding) {
                requests.forEach((request: Request) => {
                    request.count = 0;
                });
            }
            result = rows.filter((row, index)=>{
                if (exp[index] === void 0){
                    let filtered    = this.bookmarks.indexOf(index) !== -1,
                        highlight   = {
                            foregroundColor: '',
                            backgroundColor: ''
                        };
                    requests.forEach((request: Request)=>{
                        if (!filtered){
                            row.requests[request.GUID] && (filtered = true);
                            row.requests[request.GUID] && (highlight.foregroundColor = request.foregroundColor);
                            row.requests[request.GUID] && (highlight.backgroundColor = request.backgroundColor);
                        }
                        row.requests[request.GUID] && (request.count += 1);
                    });
                    row.params.highlight    = highlight;
                    row.index               = index;
                    row.update !== null && row.update(row.params);
                    if (filtered){
                        map[index] = i;
                        i += 1;
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

    getRowsByRequestsPassive(rows: Array<any>, requests: Array<Request>, exp: any = {}, adding: boolean = false){
        let map     = {},
            i       = 0,
            result  = [],
            measure = Logs.measure('[search.results/tab.results][getRowsByRequestsPassive]');
        if (requests.length > 0){
            if (!adding) {
                requests.forEach((request: Request) => {
                    request.count = 0;
                });
            }
            result = rows.filter((row, index)=>{
                if (exp[index] === void 0){
                    let filtered    = false,
                        highlight   = {
                            foregroundColor: '',
                            backgroundColor: ''
                        };
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
            _active : any               = [],
            _passive: any               = [],
            _rows   : any               = [],
            result  : any               = [],
            measure                     = Logs.measure('[search.results/tab.results][convertFilterRows]');
        switch (this.filterMode){
            case FILTER_MODES.ACTIVE_FROM_PASSIVE:
                _rows   = this.getRowsByRequestsPassive(rows, passive, {}, adding).rows;
                result  = this.getRowsByRequestsActive(_rows, active, {}, adding).rows;
                break;
            case FILTER_MODES.ACTIVE_AND_PASSIVE:
                _active     = this.getRowsByRequestsActive  (rows, active, {}, adding);
                _passive    = this.getRowsByRequestsPassive (rows, passive, _active.map, adding);
                _rows       = rows.filter((row, index)=>{
                    return this.bookmarks.indexOf(index) !== -1 ? true : (_active.map[index] !== void 0 ? true : (_passive.map[index] !== void 0));
                });
                result = _rows;
                break;
            case FILTER_MODES.ONLY_ACTIVE:
                result = this.getRowsByRequestsActive (rows, active, {}, adding).rows;
                break;
            case FILTER_MODES.ONLY_PASSIVE:
                result = this.getRowsByRequestsPassive(rows, passive, {}, adding).rows;
                break;
        }
        this.synchCounting();
        Logs.measure(measure);
        return result;
    }

    filterRows(){
        this.rows = this.convertFilterRows(this._rows, false);
        this.updateTitle();
    }

    updateRows(){
        let markersHash = this.getMarkersHash();
        this.rows instanceof Array && (this.rows = this.rows.map((row, index)=>{
            let selection   = this.selection.index === row.params.index ? true : false,
                update      = row.params.selection !== selection ? (row.update !== null) : false;
            update = row.params.GUID !== null ? (row.update !== null) : update;
            row.params.selection        = selection;
            row.params.visibility       = this.numbers;
            row.params.total_rows       = this._rows.length;
            row.params.GUID             = this.viewParams !== null ? this.viewParams.GUID : null;
            row.params.bookmarked       = this.bookmarks.indexOf(row.params.index) !== -1;
            row.params.markers          = this.markers;
            row.params.markerSelectMode = this.markerSelectMode;
            row.params.markersHash      = markersHash;
            update && row.update(row.params);
            return row;
        }));
        this.forceUpdate();
    }

    updateMarkersOnly(){
        let markersHash = this.getMarkersHash();
        this.rows instanceof Array && (this.rows = this.rows.map((row)=>{
            row.params.markers          = this.markers;
            row.params.markersHash      = markersHash;
            row.params.markerSelectMode = this.markerSelectMode;
            row.update !== null && row.update(row.params);
            return row;
        }));
    }

    getMarkersHash(){
        let hash = this.markerSelectMode;
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

    onOwnSelected(index : number){
        this.select(index, true);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED, index);
    }

    select(index: number = -1, own: boolean = false){
        this.selection.own   = own;
        this.selection.index = index;
        this.updateRows();
    }

    serializeHTML(html: string){
        return html.replace(/</gi, '&lt').replace(/>/gi, '&gt');
    }

    synchCounting(){
        this.requests.forEach((request: Request) => {
            this._requests.forEach((_request: Request) => {
                _request.GUID === request.GUID && (_request.count = request.count);
            });
        });
    }

    resetCounts(){
        this.requests.forEach((request: Request) => {
            request.count = 0;
        });
        this._requests.forEach((request: Request) => {
            request.count = 0;
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Text selection
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    onTextSelection(text: string){
        if (typeof text === 'string' && !~text.search(/[\n\r]/gi)){
            let index = this.getSelfMarkerIndex();
            text = text.replace(/[\n\r]/gi, '');
            if (text.length > 0){
                if (~index){
                    this.markers[index].value = text;
                } else {
                    this.markers.push({
                        value           : text,
                        backgroundColor : SETTINGS.TEXT_SELECTED_BACKGROUND,
                        foregroundColor : SETTINGS.TEXT_SELECTED_COLOR,
                        self            : true
                    });
                }
                this.updateMarkersOnly();
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

    addClearButton(){
        if (!this.clearFunctionality.inited){
            Events.trigger(Configuration.sets.EVENTS_VIEWS.VIEW_BAR_ADD_BUTTON, this.viewParams.GUID, {
                action  : this.clearOutput.bind(this),
                hint    : _('Clear output'),
                icon    : 'fa-eraser',
                GUID    : this.clearFunctionality.button
            }, false);
            this.clearFunctionality.inited = true;
        }
    }

    removeClearButton(){
        if (this.clearFunctionality.inited){
            Events.trigger(Configuration.sets.EVENTS_VIEWS.VIEW_BAR_REMOVE_BUTTON, this.viewParams.GUID, this.clearFunctionality.button);
            this.clearFunctionality.inited = false;
        }
    }

    clearOutput(silence: boolean = false){
        this.rows       = [];
        this.rowsCount  = 0;
        this.resetCounts();
        !silence && Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEW_OUTPUT_IS_CLEARED, this.viewParams.GUID);
        this.forceUpdate();
    }

    onVIEW_OUTPUT_IS_CLEARED(GUID: string | symbol){
        if (this.viewParams.GUID !== GUID){
            this.clearOutput(true);
        }
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

    onLIST_VIEW_NUMERIC_TRIGGER(GUID: string | symbol){
        if (GUID === this.viewParams.GUID){
            this.numbers = !this.numbers;
            this.updateRows();
        }
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
                    blob    = new Blob([str.join('\n')], {type: 'text/plain'}),
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
        this.refreshScrollState();
    }

    onDATA_IS_MODIFIED(event : EVENT_DATA_IS_UPDATED){
        if (event.rows instanceof Array){
            let measure = Logs.measure('[search.results/tab.results][onDATA_IS_MODIFIED]');
            this.addRows(event.rows);
            this.followByScroll && this.onSHORTCUT_TO_END();
            this.addClearButton();
            Logs.measure(measure);
        }
    }

    onMARKERS_UPDATED(markers: any, markerSelectMode: string){
        this.markers            = markers;
        this.markerSelectMode   = markerSelectMode;
        this.updateMarkersOnly();
    }


    getIndexInSearchList(index: number){
        let result = -1;
        if (this.rows instanceof Array){
            for(let i = this.rows.length - 1; i >= 0; i -= 1){
                if (this.rows[i].index === index) {
                    result = i;
                    break;
                }
            }
        }
        return result;
    }

    onROW_IS_SELECTED(index : number){
        let _index = this.getIndexInSearchList(index);
        if (~index && !this.selection.own && this.listView !== null && this.listView !== void 0) {
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
}
