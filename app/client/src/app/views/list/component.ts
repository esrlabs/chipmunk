import {Component, OnInit, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, OnDestroy, EventEmitter, AfterViewChecked } from '@angular/core';
import {DomSanitizer                            } from '@angular/platform-browser';

import { ViewControllerPattern                  } from '../controller.pattern';
import { ViewControllerListItem                 } from './item/component';
import { LongList                               } from '../../core/components/common/long-list/component';
import { OnScrollEvent                          } from '../../core/components/common/long-list/interface.scrollevent';

import { ListItemInterface                      } from './item/interface';
import { ListLineMark                           } from './line/interface.mark';

import { dataController                         } from '../../core/modules/controller.data';
import { Logs, TYPES as LogTypes                } from '../../core/modules/tools.logs';
import { events as Events                       } from '../../core/modules/controller.events';
import { configuration as Configuration         } from '../../core/modules/controller.config';

import { ViewInterface                          } from '../../core/interfaces/interface.view';
import { DataRow                                } from '../../core/interfaces/interface.data.row';
import { EVENT_DATA_IS_UPDATED                  } from '../../core/interfaces/events/DATA_IS_UPDATE';
import { EVENT_VIEW_BAR_ADD_FAVORITE_RESPONSE   } from '../../core/interfaces/events/VIEW_BAR_ADD_FAVORITE_RESPONSE';

import { ViewClass                              } from '../../core/services/class.view';

import { TextSelection                          } from '../../core/modules/controller.selection.text';

const SETTINGS : {
    SELECTION_OFFSET        : number,
    TEXT_SELECTED_COLOR     : string,
    TEXT_SELECTED_BACKGROUND:string
} = {
    SELECTION_OFFSET        : 3,
    TEXT_SELECTED_COLOR     : 'rgb(0,0,0)',
    TEXT_SELECTED_BACKGROUND: 'rgb(150,150,250)'
};

@Component({
    selector        : 'view-controller-list',
    templateUrl     : './template.html',
})

export class ViewControllerList extends ViewControllerPattern implements ViewInterface, OnInit, OnDestroy, AfterViewChecked {

    public viewParams       : ViewClass = null;
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

    private _rows                   : Array<any>                    = [];
    private rows                    : Array<any>                    = [];
    private rowsCount               : number                        = 0;
    private bookmarks               : Array<number>                 = [];
    private numbers                 : boolean                       = true;
    private followByScroll          : boolean                       = true;
    private showOnlyBookmarks       : boolean                       = false;
    private highlight               : boolean                       = true;
    private onScrollSubscription    : EventEmitter<OnScrollEvent>   = new EventEmitter();
    private textSelection           : TextSelection                 = null;
    private textSelectionTrigger    : EventEmitter<string>          = new EventEmitter();
    private regsCache               : Object                        = {};
    private lastBookmarkOperation   : number                       = null;
    private selection : {
        own     : boolean,
        index   : number
    } = {
        own     : false,
        index   : -1
    };

    private searchNavigation : {
        prev    : symbol,
        next    : symbol,
        inited  : boolean,
        current : number
    } = {
        prev    : Symbol(),
        next    : Symbol(),
        inited  : false,
        current : -1
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
        this.onScroll                   = this.onScroll.bind(this);
        this.onScrollByLine             = this.onScrollByLine.bind(this);
        this.onTextSelection            = this.onTextSelection.bind(this);

        [   Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            Configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            Configuration.sets.SYSTEM_EVENTS.MARKERS_UPDATED,
            Configuration.sets.EVENTS_VIEWS.LIST_VIEW_NUMERIC_TRIGGER,
            Configuration.sets.EVENTS_VIEWS.LIST_VIEW_FOLLOW_SCROLL_TRIGGER,
            Configuration.sets.EVENTS_VIEWS.LIST_VIEW_ONLY_BOOKMARKS_TRIGGER,
            Configuration.sets.EVENTS_VIEWS.LIST_VIEW_HIGHLIGHT_TRIGGER,
            Configuration.sets.EVENTS_VIEWS.LIST_VIEW_EXPORT_TO_FILE,
            Configuration.sets.SYSTEM_EVENTS.VIEW_FORCE_UPDATE_CONTENT,
            Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_BEGIN,
            Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_END,
            Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_PREV_IN_SEARCH,
            Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_NEXT_IN_SEARCH,
            Configuration.sets.SYSTEM_EVENTS.BOOKMARK_IS_CREATED,
            Configuration.sets.SYSTEM_EVENTS.BOOKMARK_IS_REMOVED,
            Configuration.sets.SYSTEM_EVENTS.VIEW_OUTPUT_IS_CLEARED].forEach((handle: string)=>{
            this['on' + handle] = this['on' + handle].bind(this);
            Events.bind(handle, this['on' + handle]);
        });

        super.getEmitters().filter.         subscribe(this.onFilterEmmiter.     bind(this));
        super.getEmitters().favoriteClick.  subscribe(this.onFavoriteClick.     bind(this));
        super.getEmitters().favoriteGOTO.   subscribe(this.onFavoriteGOTO.      bind(this));
        super.getEmitters().resize.         subscribe(this.resizeOnREMOVE_VIEW. bind(this));

        this.onScrollSubscription.  subscribe(this.onScroll);
        this.line.scrollTo.         subscribe(this.onScrollByLine);
        this.textSelectionTrigger.  subscribe(this.onTextSelection);
        this.initRows();
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.MARKERS_GET_ALL, this.onMARKERS_UPDATED.bind(this));
    }

    ngOnInit(){
        this.viewParams !== null && super.setGUID(this.viewParams.GUID);
        this.textSelection === null && (this.textSelection = new TextSelection(this.viewContainerRef.element.nativeElement, this.textSelectionTrigger));
    }

    ngOnDestroy(){
        [   Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            Configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            Configuration.sets.SYSTEM_EVENTS.MARKERS_UPDATED,
            Configuration.sets.EVENTS_VIEWS.LIST_VIEW_NUMERIC_TRIGGER,
            Configuration.sets.EVENTS_VIEWS.LIST_VIEW_FOLLOW_SCROLL_TRIGGER,
            Configuration.sets.EVENTS_VIEWS.LIST_VIEW_ONLY_BOOKMARKS_TRIGGER,
            Configuration.sets.EVENTS_VIEWS.LIST_VIEW_HIGHLIGHT_TRIGGER,
            Configuration.sets.EVENTS_VIEWS.LIST_VIEW_EXPORT_TO_FILE,
            Configuration.sets.SYSTEM_EVENTS.VIEW_FORCE_UPDATE_CONTENT,
            Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_BEGIN,
            Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_END,
            Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_PREV_IN_SEARCH,
            Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_NEXT_IN_SEARCH,
            Configuration.sets.SYSTEM_EVENTS.BOOKMARK_IS_CREATED,
            Configuration.sets.SYSTEM_EVENTS.BOOKMARK_IS_REMOVED,
            Configuration.sets.SYSTEM_EVENTS.VIEW_OUTPUT_IS_CLEARED].forEach((handle: string)=>{
            Events.unbind(handle, this['on' + handle]);
        });
        this.onScrollSubscription.  unsubscribe();
        this.line.scrollTo.         unsubscribe();
    }

    ngAfterViewChecked(){
        super.ngAfterViewChecked();
        if (this.exportdata.url !== null && this.exportURLNode !== null){
            this.exportURLNode.element.nativeElement.click();
            this.exportdata.url         = null;
            this.exportdata.filename    = '';
        }
    }

    convertRows(rows: Array<DataRow>, offset: number = 0){
        let allSelected = this.isAllFiltered(),
            markersHash = this.getMarkersHash();
        return rows.map((row, index)=>{
            let factory     = this.componentFactoryResolver.resolveComponentFactory(ViewControllerListItem),
                _index      = index + offset,
                filtered    = allSelected ? false : (this.viewParams !== null ? (row.filters[this.viewParams.GUID] !== void 0 ? row.filters[this.viewParams.GUID] : row.filtered) : row.filtered);
            return {
                factory : factory,
                params  : {
                    GUID        : this.viewParams !== null ? this.viewParams.GUID : null,
                    val         : this.serializeHTML(row.render_str),
                    original    : row.str,
                    index       : _index,
                    selection   : this.selection.index === _index ? true : false,
                    bookmarked  : ~this.bookmarks.indexOf(_index) ? true : false,
                    filtered    : this.highlight ? filtered : false,
                    match       : row.match,
                    matchReg    : row.matchReg,
                    visibility  : this.numbers,
                    total_rows  : this._rows.length === 0 ? rows.length : this._rows.length,
                    markers     : this.markers,
                    markersHash : markersHash,
                    regsCache   : this.regsCache
                },
                callback: this.onRowInit.bind(this, _index),
                update  : null,
                filtered: row.filtered  !== void 0 ? row.filtered   : true,
                filters : row.filters   !== void 0 ? row.filters    : {},
                match   : row.match,
                matchReg: row.matchReg
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

    convertFilterRows (rows: Array<any>) {
        return rows.filter((row)=>{
            row.update !== null && row.update(row.params);
            if (this.showOnlyBookmarks) {
                return row.params.bookmarked;
            } else if (this.highlight){
                return true;
            } else {
                let filtered = this.viewParams !== null ? (row.filters[this.viewParams.GUID] !== void 0 ? row.filters[this.viewParams.GUID] : row.filtered) : row.filtered;
                return super.getState().favorites ? (row.params.bookmarked ? true : filtered) : filtered;
            }
        });
    }

    initRows(rows : Array<DataRow> = null){
        let sources = rows instanceof Array ? rows : dataController.getRows();
        this._rows  = this.convertRows(sources, 0);
        this.checkLength();
        this.filterRows();
        rows instanceof Array && this.forceUpdate();
    }

    filterRows(){
        this.rows = this.convertFilterRows(this._rows);
    }

    isAllFiltered(){
        let count = 0;
        this.rows.forEach((row:DataRow)=>{
            let filtered = this.viewParams !== null ? (row.filters[this.viewParams.GUID] !== void 0 ? row.filters[this.viewParams.GUID] : row.filtered) : row.filtered;
            filtered && (count += 1);
        });
        return count === this.rows.length;
    }

    updateRows(){
        let allSelected = this.isAllFiltered(),
            markersHash = this.getMarkersHash();
        this.rows instanceof Array && (this.rows = this.rows.map((row)=>{
            let selection   = this.selection.index === row.params.index ? true : false,
                update      = row.params.selection !== selection ? (row.update !== null) : false,
                bookmarked  = ~this.bookmarks.indexOf(row.params.index),
                filtered    = allSelected ? false : (this.viewParams !== null ? (row.filters[this.viewParams.GUID] !== void 0 ? row.filters[this.viewParams.GUID] : row.filtered) : row.filtered);
            update = row.params.bookmarked  !== bookmarked  ? (row.update !== null) : update;
            update = row.params.GUID        !== null        ? (row.update !== null) : update;
            update = row.params.filtered    !== filtered    ? (row.update !== null) : update;
            row.params.selection    = selection;
            row.params.bookmarked   = bookmarked;
            row.params.visibility   = this.numbers;
            row.params.filtered     = this.highlight ? filtered : false;
            row.params.match        = row.match;
            row.params.matchReg     = row.matchReg;
            row.params.total_rows   = this._rows.length;
            row.params.GUID         = this.viewParams !== null ? this.viewParams.GUID : null;
            row.params.markers      = this.markers;
            row.params.markersHash  = markersHash;
            update && row.update(row.params);
            return row;
        }));
        this.forceUpdate();
    }

    updateMarkersOnly(){
        let markersHash = this.getMarkersHash();
        this.rows instanceof Array && (this.rows = this.rows.map((row)=>{
            row.params.markers      = this.markers;
            row.params.markersHash  = markersHash;
            row.update !== null && row.update(row.params);
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

    onOwnSelected(index : number){
        this.select(index, true);
        !super.getState().silence && Events.trigger(Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED, index);
    }

    select(index: number = -1, own: boolean = false){
        this.selection.own   = own;
        this.selection.index = index;
        this.nextAfterSearchNavigation(index);
        this.updateRows();
    }

    onBOOKMARK_IS_CREATED(index: number) {
        if (this.lastBookmarkOperation !== index) {
            this.toggleBookmark(index);
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_RESPONSE, { GUID: this.GUID, index: index });
        }
    }

    onBOOKMARK_IS_REMOVED(index: number) {
        if (this.lastBookmarkOperation !== -index) {
            this.toggleBookmark(index);
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_RESPONSE, { GUID: this.GUID, index: index });
        }
    }

    toggleBookmark(index : number) {
        if(~this.bookmarks.indexOf(index)){
            this.bookmarks.splice(this.bookmarks.indexOf(index),1);
            this.lastBookmarkOperation = -index;
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.BOOKMARK_IS_REMOVED, index);
        } else {
            this.bookmarks.push(index);
            this.lastBookmarkOperation = +index;
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.BOOKMARK_IS_CREATED, index);
        }
        if (this.bookmarks.length > 0){
            Events.trigger(Configuration.sets.EVENTS_VIEWS.VIEW_BAR_ENABLE_BUTTON,  this.viewParams.GUID, 'LIST_VIEW_ONLY_BOOKMARKS_TRIGGER');
        } else {
            Events.trigger(Configuration.sets.EVENTS_VIEWS.VIEW_BAR_DISABLE_BUTTON, this.viewParams.GUID, 'LIST_VIEW_ONLY_BOOKMARKS_TRIGGER');
        }
        this.updateRows();
    }

    serializeHTML(html: string){
        return html.replace(/</gi, '&lt').replace(/>/gi, '&gt');
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Text selection
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    onTextSelection(text: string){
        if (typeof text === 'string'){
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
     * Search navigation functionality
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    addButtonsSearchNavigation(){
        if (!this.searchNavigation.inited){
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
            this.searchNavigation.inited = true;
        }
    }

    removeButtonsSearchNavigation(){
        if (this.searchNavigation.inited){
            Events.trigger(Configuration.sets.EVENTS_VIEWS.VIEW_BAR_REMOVE_BUTTON, this.viewParams.GUID, this.searchNavigation.next);
            Events.trigger(Configuration.sets.EVENTS_VIEWS.VIEW_BAR_REMOVE_BUTTON, this.viewParams.GUID, this.searchNavigation.prev);
            this.searchNavigation.inited = false;
        }
    }

    getFirstSearchNavigation(){
        let result = -1;
        for(let i = 0; i <= this.rows.length - 1; i += 1){
            if (this.rows[i].params.filtered && i > result){
                result = i;
                break;
            }
        }
        return result;
    }

    getLastSearchNavigation(){
        let result = 10000000;
        for(let i = this.rows.length - 1; i >= 0; i -= 1){
            if (this.rows[i].params.filtered && i < result){
                result = i;
                break;
            }
        }
        return result;
    }

    previousSearchNavigation(){
        let current = this.searchNavigation.current;
        for(let i = this.rows.length - 1; i >= 0; i -= 1){
            if (this.rows[i].params.filtered && i < this.searchNavigation.current){
                current = i;
                break;
            }
        }
        if (current === this.searchNavigation.current){
            current = this.getLastSearchNavigation();
        }
        this.searchNavigation.current = current;
        ~this.searchNavigation.current && this.onROW_IS_SELECTED(this.searchNavigation.current);
    }

    nextSearchNavigation(){
        let current = this.searchNavigation.current;
        for(let i = 0; i <= this.rows.length - 1; i += 1){
            if (this.rows[i].params.filtered && i > this.searchNavigation.current){
                current = i;
                break;
            }
        }
        if (current === this.searchNavigation.current){
            current = this.getFirstSearchNavigation();
        }
        this.searchNavigation.current = current;
        ~this.searchNavigation.current && this.onROW_IS_SELECTED(this.searchNavigation.current);
    }

    nextAfterSearchNavigation(after: number){
        if (this.highlight && this.line.marks.length > 0){
            let current = -1;
            for(let i = after; i <= this.rows.length - 1; i += 1){
                if (this.rows[i].params.filtered){
                    current = i;
                    break;
                }
            }
            if (current === -1){
                current = this.getFirstSearchNavigation();
            }
            this.searchNavigation.current = current;
        }
    }

    resetSearchNavigation(){
        this.searchNavigation.current = this.getFirstSearchNavigation();
        if (this.searchNavigation.current > 0 && this.searchNavigation.current < this.rows.length){
            this.onROW_IS_SELECTED(this.searchNavigation.current);
        } else {
            this.searchNavigation.current = -1;
        }
    }

    updateSearchNavigation(){
        if(this.highlight && this.line.marks.length > 0){
            this.addButtonsSearchNavigation();
        } else {
            this.removeButtonsSearchNavigation();
        }
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Line functionality
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    updateLineScroll(event?: OnScrollEvent){
        if (event){
            this.line.scroll = event;
        } else {
            if (this.listView !== void 0 && this.listView !== null) {
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
        if (this.rows.length > 0 && this.highlight && !this.showOnlyBookmarks){
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
        this.bookmarks  = [];
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
            this.updateSearchNavigation();
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

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * View events listeners
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

    resizeOnREMOVE_VIEW(){
        this.listView !== void 0 && this.listView.forceCalculation();
        this.listView !== void 0 && this.listView.forceUpdate();
    }

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

    onLIST_VIEW_ONLY_BOOKMARKS_TRIGGER(GUID: string | symbol){
        if (GUID === this.viewParams.GUID){
            this.showOnlyBookmarks = !this.showOnlyBookmarks;
            this.filterRows();
            this.forceUpdate();
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
                        return row.params.original;
                    }),
                    blob    = new Blob([str.join('\n\r')], {type: 'text/plain'}),
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

    onSHORTCUT_PREV_IN_SEARCH(){
        if(this.highlight && this.line.marks.length > 0){
            this.previousSearchNavigation();
        }
    }

    onSHORTCUT_NEXT_IN_SEARCH(){
        if(this.highlight && this.line.marks.length > 0){
            this.nextSearchNavigation();
        }
    }

    onDATA_IS_UPDATED(event : EVENT_DATA_IS_UPDATED){
        if (event.rows instanceof Array){
            let measure = Logs.measure('[view.list][onDATA_IS_UPDATED]');
            this.initRows(event.rows);
            this.updateRows();
            this.removeClearButton();
            Logs.measure(measure);
        }
    }

    onDATA_FILTER_IS_UPDATED(event : EVENT_DATA_IS_UPDATED){
        if (event.rows instanceof Array){
            let measure = Logs.measure('[view.list][onDATA_FILTER_IS_UPDATED]');
            this._rows          = this._rows.map((row, index)=>{
                row.filtered    = event.rows[index].filtered;
                row.match       = event.rows[index].match;
                row.matchReg    = event.rows[index].matchReg;
                row.filters     = event.rows[index].filters;
                return row;
            });
            this.filterRows();
            this.updateRows();
            this.resetSearchNavigation();
            Logs.measure(measure);
        }
    }

    onDATA_IS_MODIFIED(event : EVENT_DATA_IS_UPDATED){
        if (event.rows instanceof Array){
            let measure = Logs.measure('[view.list][onDATA_IS_MODIFIED]'),
                _rows   = this.convertRows(event.rows, this._rows.length),
                rows    = this.convertFilterRows(_rows);
            this._rows.push(..._rows);
            this.rows.push(...rows);
            this.updateRows();
            this.forceUpdate();
            this.followByScroll && this.onSHORTCUT_TO_END();
            this.checkLength();
            this.addClearButton();
            Logs.measure(measure);
        }
    }

    onMARKERS_UPDATED(markers: any){
        this.markers = markers;
        this.updateMarkersOnly();
    }

    filterRestore(){
        this._rows = this._rows.map((row, index)=>{
            delete row.filters[this.viewParams.GUID];
            return row;
        });
        this.filterRows();
        this.updateRows();
    }

    correctIndex(index: number){
        let _index = -1;
        for(let i = index; i >= 0; i -= 1){
            let filtered = this.highlight ? true : this._rows[i].filtered;
            (super.getState().favorites ? (this._rows[i].params.bookmarked ? true : filtered) : filtered) && (_index +=1);
        }
        return _index;
    }

    onROW_IS_SELECTED(index : number){
        let _index = this.correctIndex(index);
        if (!this.selection.own && !super.getState().deafness){
            this.listView.scrollToIndex(_index > SETTINGS.SELECTION_OFFSET ? _index - SETTINGS.SELECTION_OFFSET : _index);
            this.select(index, false);
        } else {
            this.selection.own = false;
        }
    }

    onFavoriteClick(GUID: string){
        if (~this.selection.index){
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_RESPONSE, { GUID: GUID, index: this.selection.index });
            this.toggleBookmark(this.selection.index);
        }
    }

    onFavoriteGOTO( event: EVENT_VIEW_BAR_ADD_FAVORITE_RESPONSE){
        let _index = this.correctIndex(event.index);
        this.listView.scrollToIndex(_index > SETTINGS.SELECTION_OFFSET ? _index - SETTINGS.SELECTION_OFFSET : _index);
    }

    onFilterEmmiter(state: boolean){
        if (state){
            this.filterRestore();
        }
    }

    onVIEW_FORCE_UPDATE_CONTENT(GUID: string | symbol){
        if (GUID === this.viewParams.GUID){
            this.forceUpdate(true);
            this.updateLineScroll();
        }
    }
}
