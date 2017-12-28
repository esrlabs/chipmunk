"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var core_1 = require("@angular/core");
var platform_browser_1 = require("@angular/platform-browser");
var controller_pattern_1 = require("../controller.pattern");
var component_1 = require("./item/component");
var component_2 = require("../../core/components/common/long-list/component");
var controller_data_1 = require("../../core/modules/controller.data");
var tools_logs_1 = require("../../core/modules/tools.logs");
var controller_events_1 = require("../../core/modules/controller.events");
var controller_config_1 = require("../../core/modules/controller.config");
var controller_selection_text_1 = require("../../core/modules/controller.selection.text");
var SETTINGS = {
    SELECTION_OFFSET: 3,
    TEXT_SELECTED_COLOR: 'rgb(0,0,0)',
    TEXT_SELECTED_BACKGROUND: 'rgb(150,150,250)'
};
var ViewControllerList = (function (_super) {
    __extends(ViewControllerList, _super);
    function ViewControllerList(componentFactoryResolver, viewContainerRef, changeDetectorRef, sanitizer) {
        var _this = _super.call(this) || this;
        _this.componentFactoryResolver = componentFactoryResolver;
        _this.viewContainerRef = viewContainerRef;
        _this.changeDetectorRef = changeDetectorRef;
        _this.sanitizer = sanitizer;
        _this.viewParams = null;
        _this.exportdata = {
            url: null,
            filename: ''
        };
        _this.line = {
            visible: false,
            marks: [],
            count: 0,
            scroll: null,
            scrollTo: new core_1.EventEmitter(),
            offsetTop: 0,
            offsetBottom: 16
        };
        _this._rows = [];
        _this.rows = [];
        _this.rowsCount = 0;
        _this.bookmarks = [];
        _this.numbers = true;
        _this.followByScroll = true;
        _this.showOnlyBookmarks = false;
        _this.highlight = true;
        _this.onScrollSubscription = new core_1.EventEmitter();
        _this.textSelection = null;
        _this.textSelectionTrigger = new core_1.EventEmitter();
        _this.regsCache = {};
        _this.selection = {
            own: false,
            index: -1
        };
        _this.searchNavigation = {
            prev: Symbol(),
            next: Symbol(),
            inited: false,
            current: -1
        };
        _this.clearFunctionality = {
            button: Symbol(),
            inited: false
        };
        _this.markers = []; //Do not bind this <Marker> type, because markers view can be removed
        _this.componentFactoryResolver = componentFactoryResolver;
        _this.viewContainerRef = viewContainerRef;
        _this.changeDetectorRef = changeDetectorRef;
        _this.onScroll = _this.onScroll.bind(_this);
        _this.onScrollByLine = _this.onScrollByLine.bind(_this);
        _this.onTextSelection = _this.onTextSelection.bind(_this);
        [controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.MARKERS_UPDATED,
            controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_NUMERIC_TRIGGER,
            controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_FOLLOW_SCROLL_TRIGGER,
            controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_ONLY_BOOKMARKS_TRIGGER,
            controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_HIGHLIGHT_TRIGGER,
            controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_EXPORT_TO_FILE,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_FORCE_UPDATE_CONTENT,
            controller_config_1.configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_BEGIN,
            controller_config_1.configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_END,
            controller_config_1.configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_PREV_IN_SEARCH,
            controller_config_1.configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_NEXT_IN_SEARCH].forEach(function (handle) {
            _this['on' + handle] = _this['on' + handle].bind(_this);
            controller_events_1.events.bind(handle, _this['on' + handle]);
        });
        _super.prototype.getEmitters.call(_this).filter.subscribe(_this.onFilterEmmiter.bind(_this));
        _super.prototype.getEmitters.call(_this).favoriteClick.subscribe(_this.onFavoriteClick.bind(_this));
        _super.prototype.getEmitters.call(_this).favoriteGOTO.subscribe(_this.onFavoriteGOTO.bind(_this));
        _super.prototype.getEmitters.call(_this).resize.subscribe(_this.resizeOnREMOVE_VIEW.bind(_this));
        _this.onScrollSubscription.subscribe(_this.onScroll);
        _this.line.scrollTo.subscribe(_this.onScrollByLine);
        _this.textSelectionTrigger.subscribe(_this.onTextSelection);
        _this.initRows();
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.MARKERS_GET_ALL, _this.onMARKERS_UPDATED.bind(_this));
        return _this;
    }
    ViewControllerList.prototype.ngOnInit = function () {
        this.viewParams !== null && _super.prototype.setGUID.call(this, this.viewParams.GUID);
        this.textSelection === null && (this.textSelection = new controller_selection_text_1.TextSelection(this.viewContainerRef.element.nativeElement, this.textSelectionTrigger));
    };
    ViewControllerList.prototype.ngOnDestroy = function () {
        var _this = this;
        [controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.MARKERS_UPDATED,
            controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_NUMERIC_TRIGGER,
            controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_FOLLOW_SCROLL_TRIGGER,
            controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_ONLY_BOOKMARKS_TRIGGER,
            controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_HIGHLIGHT_TRIGGER,
            controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_EXPORT_TO_FILE,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_FORCE_UPDATE_CONTENT,
            controller_config_1.configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_BEGIN,
            controller_config_1.configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_END,
            controller_config_1.configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_PREV_IN_SEARCH,
            controller_config_1.configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_NEXT_IN_SEARCH].forEach(function (handle) {
            controller_events_1.events.unbind(handle, _this['on' + handle]);
        });
        this.onScrollSubscription.unsubscribe();
        this.line.scrollTo.unsubscribe();
    };
    ViewControllerList.prototype.ngAfterViewChecked = function () {
        _super.prototype.ngAfterViewChecked.call(this);
        if (this.exportdata.url !== null && this.exportURLNode !== null) {
            this.exportURLNode.element.nativeElement.click();
            this.exportdata.url = null;
            this.exportdata.filename = '';
        }
    };
    ViewControllerList.prototype.convertRows = function (rows, offset) {
        var _this = this;
        if (offset === void 0) { offset = 0; }
        var allSelected = this.isAllFiltered(), markersHash = this.getMarkersHash();
        return rows.map(function (row, index) {
            var factory = _this.componentFactoryResolver.resolveComponentFactory(component_1.ViewControllerListItem), _index = index + offset, filtered = allSelected ? false : (_this.viewParams !== null ? (row.filters[_this.viewParams.GUID] !== void 0 ? row.filters[_this.viewParams.GUID] : row.filtered) : row.filtered);
            return {
                factory: factory,
                params: {
                    GUID: _this.viewParams !== null ? _this.viewParams.GUID : null,
                    val: _this.serializeHTML(row.render_str),
                    original: row.str,
                    index: _index,
                    selection: _this.selection.index === _index ? true : false,
                    bookmarked: ~_this.bookmarks.indexOf(_index) ? true : false,
                    filtered: _this.highlight ? filtered : false,
                    match: row.match,
                    matchReg: row.matchReg,
                    visibility: _this.numbers,
                    total_rows: _this._rows.length === 0 ? rows.length : _this._rows.length,
                    markers: _this.markers,
                    markersHash: markersHash,
                    regsCache: _this.regsCache
                },
                callback: _this.onRowInit.bind(_this, _index),
                update: null,
                filtered: row.filtered !== void 0 ? row.filtered : true,
                filters: row.filters !== void 0 ? row.filters : {},
                match: row.match,
                matchReg: row.matchReg
            };
        });
    };
    ViewControllerList.prototype.checkLength = function () {
        var _this = this;
        if (this.rows instanceof Array) {
            if (this.rows.length.toString().length !== this.rowsCount.toString().length) {
                this.rows.forEach(function (row) {
                    row.params.total_rows = _this._rows.length;
                    typeof row.update === 'function' && row.update({ total_rows: _this._rows.length });
                });
                this.rowsCount = this.rows.length;
            }
        }
    };
    ViewControllerList.prototype.convertFilterRows = function (rows) {
        var _this = this;
        return rows.filter(function (row) {
            row.update !== null && row.update(row.params);
            if (_this.showOnlyBookmarks) {
                return row.params.bookmarked;
            }
            else if (_this.highlight) {
                return true;
            }
            else {
                var filtered = _this.viewParams !== null ? (row.filters[_this.viewParams.GUID] !== void 0 ? row.filters[_this.viewParams.GUID] : row.filtered) : row.filtered;
                return _super.prototype.getState.call(_this).favorites ? (row.params.bookmarked ? true : filtered) : filtered;
            }
        });
    };
    ViewControllerList.prototype.initRows = function (rows) {
        if (rows === void 0) { rows = null; }
        var sources = rows instanceof Array ? rows : controller_data_1.dataController.getRows();
        this._rows = this.convertRows(sources, 0);
        this.checkLength();
        this.filterRows();
        rows instanceof Array && this.forceUpdate();
    };
    ViewControllerList.prototype.filterRows = function () {
        this.rows = this.convertFilterRows(this._rows);
    };
    ViewControllerList.prototype.isAllFiltered = function () {
        var _this = this;
        var count = 0;
        this.rows.forEach(function (row) {
            var filtered = _this.viewParams !== null ? (row.filters[_this.viewParams.GUID] !== void 0 ? row.filters[_this.viewParams.GUID] : row.filtered) : row.filtered;
            filtered && (count += 1);
        });
        return count === this.rows.length;
    };
    ViewControllerList.prototype.updateRows = function () {
        var _this = this;
        var allSelected = this.isAllFiltered(), markersHash = this.getMarkersHash();
        this.rows instanceof Array && (this.rows = this.rows.map(function (row) {
            var selection = _this.selection.index === row.params.index ? true : false, update = row.params.selection !== selection ? (row.update !== null) : false, bookmarked = ~_this.bookmarks.indexOf(row.params.index), filtered = allSelected ? false : (_this.viewParams !== null ? (row.filters[_this.viewParams.GUID] !== void 0 ? row.filters[_this.viewParams.GUID] : row.filtered) : row.filtered);
            update = row.params.bookmarked !== bookmarked ? (row.update !== null) : update;
            update = row.params.GUID !== null ? (row.update !== null) : update;
            update = row.params.filtered !== filtered ? (row.update !== null) : update;
            row.params.selection = selection;
            row.params.bookmarked = bookmarked;
            row.params.visibility = _this.numbers;
            row.params.filtered = _this.highlight ? filtered : false;
            row.params.match = row.match;
            row.params.matchReg = row.matchReg;
            row.params.total_rows = _this._rows.length;
            row.params.GUID = _this.viewParams !== null ? _this.viewParams.GUID : null;
            row.params.markers = _this.markers;
            row.params.markersHash = markersHash;
            update && row.update(row.params);
            return row;
        }));
        this.forceUpdate();
    };
    ViewControllerList.prototype.updateMarkersOnly = function () {
        var _this = this;
        var markersHash = this.getMarkersHash();
        this.rows instanceof Array && (this.rows = this.rows.map(function (row) {
            row.params.markers = _this.markers;
            row.params.markersHash = markersHash;
            row.update !== null && row.update(row.params);
            return row;
        }));
    };
    ViewControllerList.prototype.getMarkersHash = function () {
        var hash = '';
        this.markers instanceof Array && this.markers.forEach(function (marker) {
            hash += marker.value + marker.foregroundColor + marker.backgroundColor;
        });
        return hash;
    };
    ViewControllerList.prototype.onRowInit = function (index, instance) {
        instance.selected.subscribe(this.onOwnSelected.bind(this));
        instance.bookmark.subscribe(this.toggleBookmark.bind(this));
        this._rows[index] !== void 0 && (this._rows[index].update = instance.update.bind(instance));
    };
    ViewControllerList.prototype.onOwnSelected = function (index) {
        this.select(index, true);
        !_super.prototype.getState.call(this).silence && controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED, index);
    };
    ViewControllerList.prototype.select = function (index, own) {
        if (index === void 0) { index = -1; }
        if (own === void 0) { own = false; }
        this.selection.own = own;
        this.selection.index = index;
        this.nextAfterSearchNavigation(index);
        this.updateRows();
    };
    ViewControllerList.prototype.toggleBookmark = function (index) {
        if (~this.bookmarks.indexOf(index)) {
            this.bookmarks.splice(this.bookmarks.indexOf(index), 1);
        }
        else {
            this.bookmarks.push(index);
        }
        if (this.bookmarks.length > 0) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_VIEWS.VIEW_BAR_ENABLE_BUTTON, this.viewParams.GUID, 'LIST_VIEW_ONLY_BOOKMARKS_TRIGGER');
        }
        else {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_VIEWS.VIEW_BAR_DISABLE_BUTTON, this.viewParams.GUID, 'LIST_VIEW_ONLY_BOOKMARKS_TRIGGER');
        }
        this.updateRows();
    };
    ViewControllerList.prototype.serializeHTML = function (html) {
        return html.replace(/</gi, '&lt').replace(/>/gi, '&gt');
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Text selection
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    ViewControllerList.prototype.onTextSelection = function (text) {
        if (typeof text === 'string') {
            var index = this.getSelfMarkerIndex();
            text = text.replace(/[\n\r]/gi, '');
            if (text.length > 0) {
                if (~index) {
                    this.markers[index].value = text;
                }
                else {
                    this.markers.push({
                        value: text,
                        backgroundColor: SETTINGS.TEXT_SELECTED_BACKGROUND,
                        foregroundColor: SETTINGS.TEXT_SELECTED_COLOR,
                        self: true
                    });
                }
                this.updateMarkersOnly();
            }
            else if (~index) {
                this.markers.splice(index, 1);
                this.updateMarkersOnly();
            }
        }
    };
    ViewControllerList.prototype.getSelfMarkerIndex = function () {
        var result = -1;
        this.markers.forEach(function (marker, index) {
            marker.self !== void 0 && (result = index);
        });
        return result;
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Search navigation functionality
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    ViewControllerList.prototype.addButtonsSearchNavigation = function () {
        if (!this.searchNavigation.inited) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_VIEWS.VIEW_BAR_ADD_BUTTON, this.viewParams.GUID, {
                action: this.previousSearchNavigation.bind(this),
                hint: _('previous'),
                icon: 'fa-chevron-up',
                GUID: this.searchNavigation.prev
            }, false);
            controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_VIEWS.VIEW_BAR_ADD_BUTTON, this.viewParams.GUID, {
                action: this.nextSearchNavigation.bind(this),
                hint: _('next'),
                icon: 'fa-chevron-down',
                GUID: this.searchNavigation.next
            }, false);
            this.searchNavigation.inited = true;
        }
    };
    ViewControllerList.prototype.removeButtonsSearchNavigation = function () {
        if (this.searchNavigation.inited) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_VIEWS.VIEW_BAR_REMOVE_BUTTON, this.viewParams.GUID, this.searchNavigation.next);
            controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_VIEWS.VIEW_BAR_REMOVE_BUTTON, this.viewParams.GUID, this.searchNavigation.prev);
            this.searchNavigation.inited = false;
        }
    };
    ViewControllerList.prototype.getFirstSearchNavigation = function () {
        var result = -1;
        for (var i = 0; i <= this.rows.length - 1; i += 1) {
            if (this.rows[i].params.filtered && i > result) {
                result = i;
                break;
            }
        }
        return result;
    };
    ViewControllerList.prototype.getLastSearchNavigation = function () {
        var result = 10000000;
        for (var i = this.rows.length - 1; i >= 0; i -= 1) {
            if (this.rows[i].params.filtered && i < result) {
                result = i;
                break;
            }
        }
        return result;
    };
    ViewControllerList.prototype.previousSearchNavigation = function () {
        var current = this.searchNavigation.current;
        for (var i = this.rows.length - 1; i >= 0; i -= 1) {
            if (this.rows[i].params.filtered && i < this.searchNavigation.current) {
                current = i;
                break;
            }
        }
        if (current === this.searchNavigation.current) {
            current = this.getLastSearchNavigation();
        }
        this.searchNavigation.current = current;
        ~this.searchNavigation.current && this.onROW_IS_SELECTED(this.searchNavigation.current);
    };
    ViewControllerList.prototype.nextSearchNavigation = function () {
        var current = this.searchNavigation.current;
        for (var i = 0; i <= this.rows.length - 1; i += 1) {
            if (this.rows[i].params.filtered && i > this.searchNavigation.current) {
                current = i;
                break;
            }
        }
        if (current === this.searchNavigation.current) {
            current = this.getFirstSearchNavigation();
        }
        this.searchNavigation.current = current;
        ~this.searchNavigation.current && this.onROW_IS_SELECTED(this.searchNavigation.current);
    };
    ViewControllerList.prototype.nextAfterSearchNavigation = function (after) {
        if (this.highlight && this.line.marks.length > 0) {
            var current = -1;
            for (var i = after; i <= this.rows.length - 1; i += 1) {
                if (this.rows[i].params.filtered) {
                    current = i;
                    break;
                }
            }
            if (current === -1) {
                current = this.getFirstSearchNavigation();
            }
            this.searchNavigation.current = current;
        }
    };
    ViewControllerList.prototype.resetSearchNavigation = function () {
        this.searchNavigation.current = this.getFirstSearchNavigation();
        if (this.searchNavigation.current > 0 && this.searchNavigation.current < this.rows.length) {
            this.onROW_IS_SELECTED(this.searchNavigation.current);
        }
        else {
            this.searchNavigation.current = -1;
        }
    };
    ViewControllerList.prototype.updateSearchNavigation = function () {
        if (this.highlight && this.line.marks.length > 0) {
            this.addButtonsSearchNavigation();
        }
        else {
            this.removeButtonsSearchNavigation();
        }
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Line functionality
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    ViewControllerList.prototype.updateLineScroll = function (event) {
        if (event) {
            this.line.scroll = event;
        }
        else {
            if (this.listView !== void 0 && this.listView !== null) {
                this.line.scroll = this.listView.getScrollState();
            }
        }
    };
    ViewControllerList.prototype.updateLineData = function () {
        var _this = this;
        this.resetLineData();
        this.rows.forEach(function (row, index) {
            row.params.filtered && _this.line.marks.push({
                position: index,
                color: 'red',
                str: row.params.val,
                onClick: _this.onROW_IS_SELECTED.bind(_this, index)
            });
        });
        this.line.count = this.rows.length;
        this.line.scroll = this.listView.getScrollState();
    };
    ViewControllerList.prototype.resetLineData = function () {
        this.line.count = 0;
        this.line.marks = [];
    };
    ViewControllerList.prototype.updateLine = function () {
        if (this.rows.length > 0 && this.highlight && !this.showOnlyBookmarks) {
            this.updateLineData();
            this.line.visible = true;
        }
        else {
            this.resetLineData();
            this.line.visible = false;
        }
    };
    ViewControllerList.prototype.onScrollByLine = function (line) {
        this.listView.scrollToIndex(line < 0 ? 0 : (line > (this.rows.length - 1) ? (this.rows.length - 1) : line));
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Clear view functionality
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    ViewControllerList.prototype.addClearButton = function () {
        if (!this.clearFunctionality.inited) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_VIEWS.VIEW_BAR_ADD_BUTTON, this.viewParams.GUID, {
                action: this.clearOutput.bind(this),
                hint: _('Clear output'),
                icon: 'fa-eraser',
                GUID: this.clearFunctionality.button
            }, false);
            this.clearFunctionality.inited = true;
        }
    };
    ViewControllerList.prototype.removeClearButton = function () {
        if (this.clearFunctionality.inited) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_VIEWS.VIEW_BAR_REMOVE_BUTTON, this.viewParams.GUID, this.clearFunctionality.button);
            this.clearFunctionality.inited = false;
        }
    };
    ViewControllerList.prototype.clearOutput = function () {
        this.rows = [];
        this.rowsCount = 0;
        this.bookmarks = [];
        this.forceUpdate();
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Other functionality
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    ViewControllerList.prototype.forceUpdate = function (forceRecalculation) {
        if (forceRecalculation === void 0) { forceRecalculation = false; }
        this.changeDetectorRef.detectChanges();
        if (this.listView !== void 0 && this.listView !== null && this.listView.update !== void 0) {
            this.updateLine();
            this.updateSearchNavigation();
            this.listView.update(forceRecalculation);
        }
    };
    ViewControllerList.prototype.onScroll = function (event) {
        if (event.isScrolledToEnd) {
            this.followByScroll = true;
        }
        else {
            this.followByScroll = false;
        }
        this.updateLineScroll(event);
        controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_FOLLOW_SCROLL_SET, this.viewParams.GUID, this.followByScroll);
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * View events listeners
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    ViewControllerList.prototype.resizeOnREMOVE_VIEW = function () {
        this.listView !== void 0 && this.listView.forceCalculation();
        this.listView !== void 0 && this.listView.forceUpdate();
    };
    ViewControllerList.prototype.onLIST_VIEW_FOLLOW_SCROLL_TRIGGER = function (GUID) {
        if (GUID === this.viewParams.GUID) {
            this.followByScroll = !this.followByScroll;
            if (this.followByScroll) {
                this.onSHORTCUT_TO_END();
            }
        }
    };
    ViewControllerList.prototype.onLIST_VIEW_NUMERIC_TRIGGER = function (GUID) {
        if (GUID === this.viewParams.GUID) {
            this.numbers = !this.numbers;
            this.updateRows();
        }
    };
    ViewControllerList.prototype.onLIST_VIEW_ONLY_BOOKMARKS_TRIGGER = function (GUID) {
        if (GUID === this.viewParams.GUID) {
            this.showOnlyBookmarks = !this.showOnlyBookmarks;
            this.filterRows();
            this.forceUpdate();
        }
    };
    ViewControllerList.prototype.onLIST_VIEW_HIGHLIGHT_TRIGGER = function (GUID) {
        if (GUID === this.viewParams.GUID) {
            this.highlight = !this.highlight;
            this.filterRows();
            this.updateRows();
            this.forceUpdate();
        }
    };
    ViewControllerList.prototype.onLIST_VIEW_EXPORT_TO_FILE = function (GUID) {
        if (GUID === this.viewParams.GUID) {
            if (this.rows instanceof Array && this.rows.length > 0) {
                var str = this.rows.map(function (row) {
                    return row.params.original;
                }), blob = new Blob([str.join('\n\r')], { type: 'text/plain' }), url = URL.createObjectURL(blob);
                this.exportdata.url = this.sanitizer.bypassSecurityTrustUrl(url);
                this.exportdata.filename = 'export_' + (new Date()).getTime() + '.txt';
                this.forceUpdate();
            }
        }
    };
    ViewControllerList.prototype.onSHORTCUT_TO_END = function () {
        if (this.rows instanceof Array && this.rows.length > 0) {
            this.listView.scrollToIndex(this.rows.length - 1);
        }
    };
    ViewControllerList.prototype.onSHORTCUT_TO_BEGIN = function () {
        if (this.rows instanceof Array && this.rows.length > 0) {
            this.listView.scrollToIndex(0);
        }
    };
    ViewControllerList.prototype.onSHORTCUT_PREV_IN_SEARCH = function () {
        if (this.highlight && this.line.marks.length > 0) {
            this.previousSearchNavigation();
        }
    };
    ViewControllerList.prototype.onSHORTCUT_NEXT_IN_SEARCH = function () {
        if (this.highlight && this.line.marks.length > 0) {
            this.nextSearchNavigation();
        }
    };
    ViewControllerList.prototype.onDATA_IS_UPDATED = function (event) {
        if (event.rows instanceof Array) {
            var measure = tools_logs_1.Logs.measure('[view.list][onDATA_IS_UPDATED]');
            this.initRows(event.rows);
            this.updateRows();
            this.removeClearButton();
            tools_logs_1.Logs.measure(measure);
        }
    };
    ViewControllerList.prototype.onDATA_FILTER_IS_UPDATED = function (event) {
        if (event.rows instanceof Array) {
            var measure = tools_logs_1.Logs.measure('[view.list][onDATA_FILTER_IS_UPDATED]');
            this._rows = this._rows.map(function (row, index) {
                row.filtered = event.rows[index].filtered;
                row.match = event.rows[index].match;
                row.matchReg = event.rows[index].matchReg;
                row.filters = event.rows[index].filters;
                return row;
            });
            this.filterRows();
            this.updateRows();
            this.resetSearchNavigation();
            tools_logs_1.Logs.measure(measure);
        }
    };
    ViewControllerList.prototype.onDATA_IS_MODIFIED = function (event) {
        if (event.rows instanceof Array) {
            var measure = tools_logs_1.Logs.measure('[view.list][onDATA_IS_MODIFIED]'), _rows = this.convertRows(event.rows, this._rows.length), rows = this.convertFilterRows(_rows);
            (_a = this._rows).push.apply(_a, _rows);
            (_b = this.rows).push.apply(_b, rows);
            this.updateRows();
            this.forceUpdate();
            this.followByScroll && this.onSHORTCUT_TO_END();
            this.checkLength();
            this.addClearButton();
            tools_logs_1.Logs.measure(measure);
        }
        var _a, _b;
    };
    ViewControllerList.prototype.onMARKERS_UPDATED = function (markers) {
        this.markers = markers;
        this.updateMarkersOnly();
    };
    ViewControllerList.prototype.filterRestore = function () {
        var _this = this;
        this._rows = this._rows.map(function (row, index) {
            delete row.filters[_this.viewParams.GUID];
            return row;
        });
        this.filterRows();
        this.updateRows();
    };
    ViewControllerList.prototype.correctIndex = function (index) {
        var _index = -1;
        for (var i = index; i >= 0; i -= 1) {
            var filtered = this.highlight ? true : this._rows[i].filtered;
            (_super.prototype.getState.call(this).favorites ? (this._rows[i].params.bookmarked ? true : filtered) : filtered) && (_index += 1);
        }
        return _index;
    };
    ViewControllerList.prototype.onROW_IS_SELECTED = function (index) {
        var _index = this.correctIndex(index);
        if (!this.selection.own && !_super.prototype.getState.call(this).deafness) {
            this.listView.scrollToIndex(_index > SETTINGS.SELECTION_OFFSET ? _index - SETTINGS.SELECTION_OFFSET : _index);
            this.select(index, false);
        }
        else {
            this.selection.own = false;
        }
    };
    ViewControllerList.prototype.onFavoriteClick = function (GUID) {
        if (~this.selection.index) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_RESPONSE, { GUID: GUID, index: this.selection.index });
            this.toggleBookmark(this.selection.index);
        }
    };
    ViewControllerList.prototype.onFavoriteGOTO = function (event) {
        var _index = this.correctIndex(event.index);
        this.listView.scrollToIndex(_index > SETTINGS.SELECTION_OFFSET ? _index - SETTINGS.SELECTION_OFFSET : _index);
    };
    ViewControllerList.prototype.onFilterEmmiter = function (state) {
        if (state) {
            this.filterRestore();
        }
    };
    ViewControllerList.prototype.onVIEW_FORCE_UPDATE_CONTENT = function (GUID) {
        if (GUID === this.viewParams.GUID) {
            this.forceUpdate(true);
            this.updateLineScroll();
        }
    };
    return ViewControllerList;
}(controller_pattern_1.ViewControllerPattern));
__decorate([
    core_1.ViewChild(component_2.LongList),
    __metadata("design:type", component_2.LongList)
], ViewControllerList.prototype, "listView", void 0);
__decorate([
    core_1.ViewChild('exporturl', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.ViewContainerRef)
], ViewControllerList.prototype, "exportURLNode", void 0);
ViewControllerList = __decorate([
    core_1.Component({
        selector: 'view-controller-list',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ComponentFactoryResolver,
        core_1.ViewContainerRef,
        core_1.ChangeDetectorRef,
        platform_browser_1.DomSanitizer])
], ViewControllerList);
exports.ViewControllerList = ViewControllerList;
//# sourceMappingURL=component.js.map