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
var component_1 = require("../../list/item/component");
var component_2 = require("../../../core/components/common/long-list/component");
var tools_logs_1 = require("../../../core/modules/tools.logs");
var controller_events_1 = require("../../../core/modules/controller.events");
var controller_config_1 = require("../../../core/modules/controller.config");
var controller_selection_text_1 = require("../../../core/modules/controller.selection.text");
var class_tab_controller_1 = require("../../../core/components/common/tabs/tab/class.tab.controller");
var SETTINGS = {
    SELECTION_OFFSET: 3,
    TEXT_SELECTED_COLOR: 'rgb(0,0,0)',
    TEXT_SELECTED_BACKGROUND: 'rgb(150,150,250)'
};
var FILTER_MODES = {
    ACTIVE_FROM_PASSIVE: 'ACTIVE_FROM_PASSIVE',
    ACTIVE_AND_PASSIVE: 'ACTIVE_AND_PASSIVE',
    ONLY_ACTIVE: 'ONLY_ACTIVE',
    ONLY_PASSIVE: 'ONLY_PASSIVE'
};
var TabControllerSearchResults = (function (_super) {
    __extends(TabControllerSearchResults, _super);
    function TabControllerSearchResults(componentFactoryResolver, viewContainerRef, changeDetectorRef, sanitizer) {
        var _this = _super.call(this) || this;
        _this.componentFactoryResolver = componentFactoryResolver;
        _this.viewContainerRef = viewContainerRef;
        _this.changeDetectorRef = changeDetectorRef;
        _this.sanitizer = sanitizer;
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
        _this.numbers = true;
        _this.followByScroll = true;
        _this.highlight = true;
        _this.onScrollSubscription = new core_1.EventEmitter();
        _this.textSelection = null;
        _this.textSelectionTrigger = new core_1.EventEmitter();
        _this.regsCache = {};
        _this.requests = [];
        _this._requests = [];
        _this.requestsListClosed = true;
        _this.filterMode = FILTER_MODES.ACTIVE_AND_PASSIVE;
        _this.conditions = [
            { caption: 'Active from Passive', value: FILTER_MODES.ACTIVE_FROM_PASSIVE },
            { caption: 'Active and Passive', value: FILTER_MODES.ACTIVE_AND_PASSIVE },
            { caption: 'Only Active', value: FILTER_MODES.ONLY_ACTIVE },
            { caption: 'Only Passive', value: FILTER_MODES.ONLY_PASSIVE }
        ];
        _this.selection = {
            own: false,
            index: -1
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
        _this.onTabSelected = _this.onTabSelected.bind(_this);
        _this.onTabDeselected = _this.onTabDeselected.bind(_this);
        _this.onResizeHandle = _this.onResizeHandle.bind(_this);
        _this.onConditionChanged = _this.onConditionChanged.bind(_this);
        [controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.MARKERS_UPDATED,
            controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_NUMERIC_TRIGGER,
            controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_FOLLOW_SCROLL_TRIGGER,
            controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_HIGHLIGHT_TRIGGER,
            controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_EXPORT_TO_FILE,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_FORCE_UPDATE_CONTENT,
            controller_config_1.configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_BEGIN,
            controller_config_1.configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_END,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.REQUESTS_APPLIED].forEach(function (handle) {
            _this['on' + handle] = _this['on' + handle].bind(_this);
            controller_events_1.events.bind(handle, _this['on' + handle]);
        });
        _this.onScrollSubscription.subscribe(_this.onScroll);
        _this.line.scrollTo.subscribe(_this.onScrollByLine);
        _this.textSelectionTrigger.subscribe(_this.onTextSelection);
        _this.initRequests();
        _this.initRows();
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.MARKERS_GET_ALL, _this.onMARKERS_UPDATED.bind(_this));
        return _this;
    }
    TabControllerSearchResults.prototype.ngOnInit = function () {
        this.textSelection === null && (this.textSelection = new controller_selection_text_1.TextSelection(this.viewContainerRef.element.nativeElement, this.textSelectionTrigger));
        this.onSelect.subscribe(this.onTabSelected);
        this.onDeselect.subscribe(this.onTabDeselected);
        this.onResize.subscribe(this.onResizeHandle);
    };
    TabControllerSearchResults.prototype.ngOnDestroy = function () {
        var _this = this;
        [controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.MARKERS_UPDATED,
            controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_NUMERIC_TRIGGER,
            controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_FOLLOW_SCROLL_TRIGGER,
            controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_HIGHLIGHT_TRIGGER,
            controller_config_1.configuration.sets.EVENTS_VIEWS.LIST_VIEW_EXPORT_TO_FILE,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_FORCE_UPDATE_CONTENT,
            controller_config_1.configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_BEGIN,
            controller_config_1.configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TO_END,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.REQUESTS_APPLIED].forEach(function (handle) {
            controller_events_1.events.unbind(handle, _this['on' + handle]);
        });
        this.onScrollSubscription.unsubscribe();
        this.line.scrollTo.unsubscribe();
        this.onSelect.unsubscribe();
        this.onDeselect.unsubscribe();
        this.onResize.unsubscribe();
    };
    TabControllerSearchResults.prototype.ngAfterViewChecked = function () {
        if (this.exportdata.url !== null && this.exportURLNode !== null) {
            this.exportURLNode.element.nativeElement.click();
            this.exportdata.url = null;
            this.exportdata.filename = '';
        }
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Requests functionality
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    TabControllerSearchResults.prototype.initRequests = function () {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_GET_ALL, this.onREQUESTS_HISTORY_UPDATED.bind(this));
    };
    TabControllerSearchResults.prototype.onREQUESTS_HISTORY_UPDATED = function (requests, _requests) {
        var _this = this;
        this.requests = requests;
        this._requests = _requests.map(function (request) {
            request['onChangeState'] = _this.onRequestChanged.bind(_this, request.GUID);
            return request;
        });
        this.forceUpdate();
    };
    TabControllerSearchResults.prototype.onREQUESTS_APPLIED = function (rows) {
        var measure = tools_logs_1.Logs.measure('[search.results/tab.results][onREQUESTS_APPLIED]');
        this.initRows(rows);
        tools_logs_1.Logs.measure(measure);
    };
    TabControllerSearchResults.prototype.onRequestChanged = function (GUID, active) {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_UPDATED_OUTSIDE, this._requests.map(function (request) {
            var result = null;
            GUID === request.GUID && (request.active = active);
            result = Object.assign({}, request);
            delete result['onChangeState'];
            return result;
        }));
    };
    TabControllerSearchResults.prototype.onConditionChanged = function (filterMdoe) {
        this.filterMode = filterMdoe;
        this.filterRows();
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Tab functions
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    TabControllerSearchResults.prototype.onTabSelected = function () {
        this.forceUpdate();
        this.listView !== void 0 && this.listView.forceCalculation();
        this.listView !== void 0 && this.listView.forceUpdate();
    };
    TabControllerSearchResults.prototype.onTabDeselected = function () {
    };
    TabControllerSearchResults.prototype.onResizeHandle = function () {
        this.forceUpdate();
        this.listView !== void 0 && this.listView.forceCalculation();
        this.listView !== void 0 && this.listView.forceUpdate();
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Inline requests list
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    TabControllerSearchResults.prototype.onRequestListTrigger = function () {
        this.requestsListClosed = !this.requestsListClosed;
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Rows stuff
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    TabControllerSearchResults.prototype.initRows = function (rows) {
        if (rows === void 0) { rows = null; }
        var sources = rows instanceof Array ? rows : [];
        this._rows = this.convertRows(sources, 0);
        this.checkLength();
        this.filterRows();
        rows instanceof Array && this.forceUpdate();
    };
    TabControllerSearchResults.prototype.addRows = function (rows) {
        if (rows === void 0) { rows = null; }
        var sources = rows instanceof Array ? rows : [], rowsClear = this.convertRows(sources, this._rows.length), rowsFiltered = this.convertFilterRows(rowsClear);
        (_a = this._rows).push.apply(_a, rowsClear);
        (_b = this.rows).push.apply(_b, rowsFiltered);
        this.checkLength();
        this.forceUpdate();
        var _a, _b;
    };
    TabControllerSearchResults.prototype.convertRows = function (rows, offset) {
        var _this = this;
        if (offset === void 0) { offset = 0; }
        var markersHash = this.getMarkersHash();
        return rows.map(function (row, index) {
            var factory = _this.componentFactoryResolver.resolveComponentFactory(component_1.ViewControllerListItem), _index = index + offset;
            return {
                factory: factory,
                params: {
                    GUID: _this.viewParams !== null ? _this.viewParams.GUID : null,
                    val: row.render_str,
                    original: row.str,
                    index: _index,
                    selection: _this.selection.index === _index ? true : false,
                    bookmarked: false,
                    visibility: _this.numbers,
                    total_rows: _this._rows.length === 0 ? rows.length : _this._rows.length,
                    markers: _this.markers,
                    markersHash: markersHash,
                    regsCache: _this.regsCache,
                    highlight: {
                        foregroundColor: '',
                        backgroundColor: ''
                    }
                },
                requests: row.requests,
                callback: _this.onRowInit.bind(_this, _index),
                update: null
            };
        });
    };
    TabControllerSearchResults.prototype.checkLength = function () {
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
    TabControllerSearchResults.prototype.getPassiveFilters = function () {
        return this.requests.filter(function (request) {
            return request.passive;
        });
    };
    TabControllerSearchResults.prototype.getActiveFilters = function () {
        return this.requests.filter(function (request) {
            return !request.passive;
        });
    };
    TabControllerSearchResults.prototype.getRowsByRequestsActive = function (rows, requests, exp) {
        if (exp === void 0) { exp = {}; }
        var map = {}, i = 0, result = [], measure = tools_logs_1.Logs.measure('[search.results/tab.results][getRowsByRequestsActive]');
        if (requests.length > 0) {
            result = rows.filter(function (row, index) {
                if (exp[index] === void 0) {
                    var filtered_1 = false, highlight_1 = {
                        foregroundColor: '',
                        backgroundColor: ''
                    };
                    requests.forEach(function (request) {
                        if (!filtered_1) {
                            row.requests[request.GUID] && (filtered_1 = true);
                            row.requests[request.GUID] && (highlight_1.foregroundColor = request.foregroundColor);
                            row.requests[request.GUID] && (highlight_1.backgroundColor = request.backgroundColor);
                        }
                    });
                    row.params.highlight = highlight_1;
                    row.index = index;
                    row.update !== null && row.update(row.params);
                    if (filtered_1) {
                        map[index] = i;
                        i += 1;
                    }
                    return filtered_1;
                }
                else {
                    return false;
                }
            });
        }
        tools_logs_1.Logs.measure(measure);
        return {
            rows: result,
            map: map
        };
    };
    TabControllerSearchResults.prototype.getRowsByRequestsPassive = function (rows, requests, exp) {
        if (exp === void 0) { exp = {}; }
        var map = {}, i = 0, result = [], measure = tools_logs_1.Logs.measure('[search.results/tab.results][getRowsByRequestsPassive]');
        if (requests.length > 0) {
            result = rows.filter(function (row, index) {
                if (exp[index] === void 0) {
                    var filtered_2 = false, highlight_2 = {
                        foregroundColor: '',
                        backgroundColor: ''
                    };
                    requests.forEach(function (request) {
                        if (!filtered_2) {
                            !row.requests[request.GUID] && (filtered_2 = true);
                            !row.requests[request.GUID] && (highlight_2.foregroundColor = request.foregroundColor);
                            !row.requests[request.GUID] && (highlight_2.backgroundColor = request.backgroundColor);
                        }
                        else {
                            row.requests[request.GUID] && (filtered_2 = false);
                            row.requests[request.GUID] && (highlight_2.foregroundColor = '');
                            row.requests[request.GUID] && (highlight_2.backgroundColor = '');
                        }
                    });
                    row.params.highlight = highlight_2;
                    row.update !== null && row.update(row.params);
                    if (filtered_2) {
                        map[index] = i;
                        i += 1;
                    }
                    return filtered_2;
                }
                else {
                    return false;
                }
            });
        }
        tools_logs_1.Logs.measure(measure);
        return {
            rows: result,
            map: map
        };
    };
    TabControllerSearchResults.prototype.convertFilterRows = function (rows) {
        var active = this.getActiveFilters(), passive = this.getPassiveFilters(), _active = [], _passive = [], _rows = [], result = [], measure = tools_logs_1.Logs.measure('[search.results/tab.results][convertFilterRows]');
        switch (this.filterMode) {
            case FILTER_MODES.ACTIVE_FROM_PASSIVE:
                _rows = this.getRowsByRequestsPassive(rows, passive).rows;
                result = this.getRowsByRequestsActive(_rows, active).rows;
                break;
            case FILTER_MODES.ACTIVE_AND_PASSIVE:
                _active = this.getRowsByRequestsActive(rows, active);
                _passive = this.getRowsByRequestsPassive(rows, passive, _active.map);
                _rows = rows.filter(function (row, index) {
                    return _active.map[index] !== void 0 ? true : (_passive.map[index] !== void 0);
                });
                result = _rows;
                break;
            case FILTER_MODES.ONLY_ACTIVE:
                result = this.getRowsByRequestsActive(rows, active).rows;
                break;
            case FILTER_MODES.ONLY_PASSIVE:
                result = this.getRowsByRequestsPassive(rows, passive).rows;
                break;
        }
        tools_logs_1.Logs.measure(measure);
        return result;
    };
    TabControllerSearchResults.prototype.filterRows = function () {
        this.rows = this.convertFilterRows(this._rows);
    };
    TabControllerSearchResults.prototype.updateRows = function () {
        var _this = this;
        var markersHash = this.getMarkersHash();
        this.rows instanceof Array && (this.rows = this.rows.map(function (row) {
            var selection = _this.selection.index === row.params.index ? true : false, update = row.params.selection !== selection ? (row.update !== null) : false;
            update = row.params.GUID !== null ? (row.update !== null) : update;
            row.params.selection = selection;
            row.params.visibility = _this.numbers;
            row.params.total_rows = _this._rows.length;
            row.params.GUID = _this.viewParams !== null ? _this.viewParams.GUID : null;
            row.params.markers = _this.markers;
            row.params.markersHash = markersHash;
            update && row.update(row.params);
            return row;
        }));
        this.forceUpdate();
    };
    TabControllerSearchResults.prototype.updateMarkersOnly = function () {
        var _this = this;
        var markersHash = this.getMarkersHash();
        this.rows instanceof Array && (this.rows = this.rows.map(function (row) {
            row.params.markers = _this.markers;
            row.params.markersHash = markersHash;
            row.update !== null && row.update(row.params);
            return row;
        }));
    };
    TabControllerSearchResults.prototype.getMarkersHash = function () {
        var hash = '';
        this.markers instanceof Array && this.markers.forEach(function (marker) {
            hash += marker.value + marker.foregroundColor + marker.backgroundColor;
        });
        return hash;
    };
    TabControllerSearchResults.prototype.onRowInit = function (index, instance) {
        instance.selected.subscribe(this.onOwnSelected.bind(this));
        this._rows[index] !== void 0 && (this._rows[index].update = instance.update.bind(instance));
    };
    TabControllerSearchResults.prototype.onOwnSelected = function (index) {
        this.select(index, true);
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED, index);
    };
    TabControllerSearchResults.prototype.select = function (index, own) {
        if (index === void 0) { index = -1; }
        if (own === void 0) { own = false; }
        this.selection.own = own;
        this.selection.index = index;
        this.updateRows();
    };
    TabControllerSearchResults.prototype.serializeHTML = function (html) {
        return html.replace(/</gi, '&lt').replace(/>/gi, '&gt');
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Text selection
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    TabControllerSearchResults.prototype.onTextSelection = function (text) {
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
    TabControllerSearchResults.prototype.getSelfMarkerIndex = function () {
        var result = -1;
        this.markers.forEach(function (marker, index) {
            marker.self !== void 0 && (result = index);
        });
        return result;
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Line functionality
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    TabControllerSearchResults.prototype.updateLineScroll = function (event) {
        if (event) {
            this.line.scroll = event;
        }
        else {
            if (this.listView !== void 0 && this.listView.getScrollState !== void 0) {
                this.line.scroll = this.listView.getScrollState();
            }
        }
    };
    TabControllerSearchResults.prototype.updateLineData = function () {
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
    TabControllerSearchResults.prototype.resetLineData = function () {
        this.line.count = 0;
        this.line.marks = [];
    };
    TabControllerSearchResults.prototype.updateLine = function () {
        if (this.rows.length > 0 && this.highlight) {
            this.updateLineData();
            this.line.visible = true;
        }
        else {
            this.resetLineData();
            this.line.visible = false;
        }
    };
    TabControllerSearchResults.prototype.onScrollByLine = function (line) {
        this.listView.scrollToIndex(line < 0 ? 0 : (line > (this.rows.length - 1) ? (this.rows.length - 1) : line));
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Clear view functionality
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    TabControllerSearchResults.prototype.addClearButton = function () {
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
    TabControllerSearchResults.prototype.removeClearButton = function () {
        if (this.clearFunctionality.inited) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_VIEWS.VIEW_BAR_REMOVE_BUTTON, this.viewParams.GUID, this.clearFunctionality.button);
            this.clearFunctionality.inited = false;
        }
    };
    TabControllerSearchResults.prototype.clearOutput = function () {
        this.rows = [];
        this.rowsCount = 0;
        this.forceUpdate();
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Other functionality
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    TabControllerSearchResults.prototype.forceUpdate = function (forceRecalculation) {
        if (forceRecalculation === void 0) { forceRecalculation = false; }
        this.changeDetectorRef.detectChanges();
        if (this.listView !== void 0 && this.listView !== null && this.listView.update !== void 0) {
            this.updateLine();
            this.listView.update(forceRecalculation);
        }
    };
    TabControllerSearchResults.prototype.onScroll = function (event) {
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
    TabControllerSearchResults.prototype.onLIST_VIEW_FOLLOW_SCROLL_TRIGGER = function (GUID) {
        if (GUID === this.viewParams.GUID) {
            this.followByScroll = !this.followByScroll;
            if (this.followByScroll) {
                this.onSHORTCUT_TO_END();
            }
        }
    };
    TabControllerSearchResults.prototype.onLIST_VIEW_NUMERIC_TRIGGER = function (GUID) {
        if (GUID === this.viewParams.GUID) {
            this.numbers = !this.numbers;
            this.updateRows();
        }
    };
    TabControllerSearchResults.prototype.onLIST_VIEW_HIGHLIGHT_TRIGGER = function (GUID) {
        if (GUID === this.viewParams.GUID) {
            this.highlight = !this.highlight;
            this.filterRows();
            this.updateRows();
            this.forceUpdate();
        }
    };
    TabControllerSearchResults.prototype.onLIST_VIEW_EXPORT_TO_FILE = function (GUID) {
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
    TabControllerSearchResults.prototype.onSHORTCUT_TO_END = function () {
        if (this.rows instanceof Array && this.rows.length > 0) {
            this.listView.scrollToIndex(this.rows.length - 1);
        }
    };
    TabControllerSearchResults.prototype.onSHORTCUT_TO_BEGIN = function () {
        if (this.rows instanceof Array && this.rows.length > 0) {
            this.listView.scrollToIndex(0);
        }
    };
    TabControllerSearchResults.prototype.onDATA_IS_UPDATED = function (event) {
        if (event.rows instanceof Array) {
        }
    };
    TabControllerSearchResults.prototype.onDATA_IS_MODIFIED = function (event) {
        if (event.rows instanceof Array) {
            var measure = tools_logs_1.Logs.measure('[search.results/tab.results][onDATA_IS_MODIFIED]');
            this.addRows(event.rows);
            this.followByScroll && this.onSHORTCUT_TO_END();
            this.addClearButton();
            tools_logs_1.Logs.measure(measure);
        }
    };
    TabControllerSearchResults.prototype.onMARKERS_UPDATED = function (markers) {
        this.markers = markers;
        this.updateMarkersOnly();
    };
    TabControllerSearchResults.prototype.correctIndex = function (index) {
        var _index = -1;
        for (var i = index; i >= 0; i -= 1) {
            var filtered = this.highlight ? true : this._rows[i].filtered;
        }
        return _index;
    };
    TabControllerSearchResults.prototype.onROW_IS_SELECTED = function (index) {
        /*
        let _index = this.correctIndex(index);
        if (!this.selection.own && !super.getState().deafness){
            this.listView.scrollToIndex(_index > SETTINGS.SELECTION_OFFSET ? _index - SETTINGS.SELECTION_OFFSET : _index);
            this.select(index, false);
        } else {
            this.selection.own = false;
        }
        */
    };
    TabControllerSearchResults.prototype.onFavoriteGOTO = function (event) {
        var _index = this.correctIndex(event.index);
        this.listView.scrollToIndex(_index > SETTINGS.SELECTION_OFFSET ? _index - SETTINGS.SELECTION_OFFSET : _index);
    };
    TabControllerSearchResults.prototype.onFilterEmmiter = function (state) {
        if (state) {
        }
    };
    TabControllerSearchResults.prototype.onVIEW_FORCE_UPDATE_CONTENT = function (GUID) {
        if (GUID === this.viewParams.GUID) {
            this.forceUpdate(true);
            this.updateLineScroll();
        }
    };
    return TabControllerSearchResults;
}(class_tab_controller_1.TabController));
__decorate([
    core_1.ViewChild(component_2.LongList),
    __metadata("design:type", component_2.LongList)
], TabControllerSearchResults.prototype, "listView", void 0);
__decorate([
    core_1.ViewChild('exporturl', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.ViewContainerRef)
], TabControllerSearchResults.prototype, "exportURLNode", void 0);
TabControllerSearchResults = __decorate([
    core_1.Component({
        selector: 'tab-search-results',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ComponentFactoryResolver,
        core_1.ViewContainerRef,
        core_1.ChangeDetectorRef,
        platform_browser_1.DomSanitizer])
], TabControllerSearchResults);
exports.TabControllerSearchResults = TabControllerSearchResults;
//# sourceMappingURL=component.js.map