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
var controller_data_1 = require("../../../core/modules/controller.data");
var tools_logs_1 = require("../../../core/modules/tools.logs");
var controller_events_1 = require("../../../core/modules/controller.events");
var controller_config_1 = require("../../../core/modules/controller.config");
var tools_guid_1 = require("../../../core/modules/tools.guid");
var D3_series_1 = require("./D3.series");
var controller_data_parsers_tracker_manager_1 = require("../../../core/modules/parsers/controller.data.parsers.tracker.manager");
var class_tab_controller_1 = require("../class.tab.controller");
var OFFSET_DIRECTION = {
    RIGHT: Symbol(),
    LEFT: Symbol()
};
var RowsData = (function () {
    function RowsData() {
        this.data = {};
        this.textColors = {};
        this.lineColors = {};
        this.start = null;
        this.end = null;
        this.min = Infinity;
        this.max = -1;
    }
    return RowsData;
}());
var ViewControllerTabChart = (function (_super) {
    __extends(ViewControllerTabChart, _super);
    function ViewControllerTabChart(componentFactoryResolver, viewContainerRef, changeDetectorRef) {
        var _this = _super.call(this) || this;
        _this.componentFactoryResolver = componentFactoryResolver;
        _this.viewContainerRef = viewContainerRef;
        _this.changeDetectorRef = changeDetectorRef;
        _this.size = {
            width: 100,
            height: 100
        };
        _this.D3 = null;
        _this.rows = null;
        _this._rows = [];
        _this.manager = new controller_data_parsers_tracker_manager_1.Manager();
        _this.sets = null;
        _this.active = true;
        _this.GUID = tools_guid_1.GUID.generate();
        _this.selection = {
            own: false,
            index: -1
        };
        _this.onTabSelected = _this.onTabSelected.bind(_this);
        _this.onTabDeselected = _this.onTabDeselected.bind(_this);
        _this.onResizeHandle = _this.onResizeHandle.bind(_this);
        [controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            controller_config_1.configuration.sets.EVENTS_VIEWS.CHART_VIEW_CHARTS_UPDATED,
            controller_config_1.configuration.sets.EVENTS_VIEWS.CHART_VIEW_CHARTS_STYLE_UPDATED].forEach(function (handle) {
            _this['on' + handle] = _this['on' + handle].bind(_this);
            controller_events_1.events.bind(handle, _this['on' + handle]);
        });
        //Load available sets
        _this.loadSets();
        return _this;
    }
    ViewControllerTabChart.prototype.ngOnInit = function () {
        //this.viewParams !== null && super.setGUID(this.viewParams.GUID);
        this.onSelect.subscribe(this.onTabSelected);
        this.onDeselect.subscribe(this.onTabDeselected);
        this.onResize.subscribe(this.onResizeHandle);
    };
    ViewControllerTabChart.prototype.ngAfterViewChecked = function () {
        if (this.active) {
            this.onWindowResize();
            if (this.D3 === null && this._rows.length === 0) {
                this.onDATA_IS_UPDATED({ rows: controller_data_1.dataController.getRows() }, false);
            }
            if (this.D3 === null && this.svg !== void 0) {
                this.initD3Controller();
            }
        }
    };
    ViewControllerTabChart.prototype.ngOnDestroy = function () {
        var _this = this;
        this.D3 !== null && this.D3.destroy();
        [controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
            controller_config_1.configuration.sets.EVENTS_VIEWS.CHART_VIEW_CHARTS_UPDATED,
            controller_config_1.configuration.sets.EVENTS_VIEWS.CHART_VIEW_CHARTS_STYLE_UPDATED].forEach(function (handle) {
            controller_events_1.events.unbind(handle, _this['on' + handle]);
        });
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Tab functions
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    ViewControllerTabChart.prototype.onTabSelected = function () {
        this.active = true;
        this.ngAfterViewChecked();
        this.forceUpdate();
    };
    ViewControllerTabChart.prototype.onTabDeselected = function () {
        this.active = false;
        this.D3 !== null && this.D3.destroy();
        this.D3 = null;
    };
    ViewControllerTabChart.prototype.onResizeHandle = function () {
        this.forceUpdate();
    };
    ViewControllerTabChart.prototype.onWindowResize = function () {
        if (this.active) {
            var size = this.viewContainerRef.element.nativeElement.getBoundingClientRect();
            this.size.height = size.height;
            this.size.width = size.width;
            this.D3 !== null && this.D3.resize();
        }
    };
    ViewControllerTabChart.prototype.initD3Controller = function () {
        if (this.active && this.rows.start !== null && this.rows.end !== null) {
            this.D3 === null && (this.D3 = new D3_series_1.D3Controller('svg[id="' + this.GUID + '"]', this.onSelectChart.bind(this)));
            this.D3.onData(this.rows);
        }
    };
    ViewControllerTabChart.prototype.forceUpdate = function () {
        this.active && this.changeDetectorRef.detectChanges();
    };
    ViewControllerTabChart.prototype.forceUpdateD3 = function () {
        this.active && (this.D3 !== null && this.D3.onData(this.rows));
    };
    ViewControllerTabChart.prototype.loadSets = function () {
        this.sets = this.manager.load();
        this.sets = this.sets !== null ? (typeof this.sets === 'object' ? this.sets : {}) : {};
    };
    ViewControllerTabChart.prototype.isAnySets = function () {
        return Object.keys(this.sets).length > 0 ? (this.rows === null ? false : (Object.keys(this.rows.data).length > 0)) : false;
    };
    ViewControllerTabChart.prototype.initRowsData = function () {
        if (this.rows === null) {
            this.resetRowsDate();
        }
    };
    ViewControllerTabChart.prototype.resetRowsDate = function () {
        this.rows = new RowsData();
    };
    ViewControllerTabChart.prototype.updateTimeBorders = function () {
        if (this.rows !== null) {
        }
    };
    ViewControllerTabChart.prototype.onSelectChart = function (datetime) {
        if (this._rows instanceof Array) {
            var cursor_1 = datetime.getTime(), position_1 = -1;
            try {
                this._rows.forEach(function (row, index) {
                    if (row.parsed.timestamp instanceof Array && row.parsed.timestamp.length > 0) {
                        var timestamp = row.parsed.timestamp[0].timestamp;
                        if (timestamp >= cursor_1) {
                            position_1 = index;
                            throw Error('found');
                        }
                    }
                });
            }
            catch (e) { }
            ~position_1 && controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED, position_1, this.viewParams.GUID);
        }
    };
    ViewControllerTabChart.prototype.parseData = function (source, dest) {
        var _this = this;
        var timestamp = -1, POSTPONE_WRONG_DATES = false;
        source.map(function (row) {
            if (row.parsed !== void 0 && row.parsed.timestamp instanceof Array && row.parsed.timestamp.length > 0) {
                if (POSTPONE_WRONG_DATES || timestamp <= row.parsed.timestamp[0].timestamp) {
                    timestamp = row.parsed.timestamp[0].timestamp;
                    Object.keys(_this.sets).forEach(function (GUID) {
                        if (_this.sets[GUID].active && row.parsed.tracks !== null && typeof row.parsed.tracks === 'object' &&
                            row.parsed.tracks[GUID] instanceof Array && row.parsed.tracks[GUID].length > 0) {
                            dest.data[GUID] === void 0 && (dest.data[GUID] = []);
                            row.parsed.tracks[GUID].forEach(function (index) {
                                dest.data[GUID].push({
                                    datetime: row.parsed.timestamp[0].datetime,
                                    value: index.index,
                                    key: index.label
                                });
                                dest.end = row.parsed.timestamp[0].datetime;
                                dest.start === null && (dest.start = row.parsed.timestamp[0].datetime);
                                dest.min > index.index && (dest.min = index.index);
                                dest.max < index.index && (dest.max = index.index);
                            });
                        }
                    });
                }
                else {
                }
            }
        });
        dest.textColors = {};
        dest.lineColors = {};
        Object.keys(this.sets).forEach(function (GUID) {
            dest.textColors[GUID] = _this.sets[GUID].textColor;
            dest.lineColors[GUID] = _this.sets[GUID].lineColor;
        });
        return dest;
    };
    ViewControllerTabChart.prototype.onDATA_IS_UPDATED = function (event, updateD3) {
        if (updateD3 === void 0) { updateD3 = true; }
        if (event.rows instanceof Array && event.rows.length > 0) {
            var measure = tools_logs_1.Logs.measure('[view.chart][onDATA_IS_UPDATED]');
            this.resetRowsDate();
            this._rows = event.rows;
            this.rows = this.parseData(event.rows, this.rows);
            this.forceUpdate();
            updateD3 && this.forceUpdateD3();
            tools_logs_1.Logs.measure(measure);
        }
    };
    ViewControllerTabChart.prototype.onDATA_FILTER_IS_UPDATED = function (event) {
        if (event.rows instanceof Array) {
        }
    };
    ViewControllerTabChart.prototype.onDATA_IS_MODIFIED = function (event) {
        var _this = this;
        if (event.rows instanceof Array) {
            var measure = tools_logs_1.Logs.measure('[view.chart][onDATA_IS_MODIFIED]'), rows_1 = new RowsData();
            rows_1 = this.parseData(event.rows, rows_1);
            this.initRowsData();
            Object.keys(this.rows.data).forEach(function (key) {
                if (rows_1.data[key] !== void 0) {
                    (_a = _this.rows.data[key]).push.apply(_a, rows_1.data[key]);
                }
                var _a;
            });
            Object.keys(rows_1.data).forEach(function (key) {
                if (_this.rows.data[key] === void 0) {
                    _this.rows.data[key] = rows_1.data[key];
                }
            });
            this.rows.start = this.rows.start === null ? rows_1.start : this.rows.start;
            this.rows.max = this.rows.max > rows_1.max ? this.rows.max : rows_1.max;
            this.rows.min = this.rows.min < rows_1.min ? this.rows.min : rows_1.min;
            this.rows.end = rows_1.end;
            (_a = this._rows).push.apply(_a, event.rows);
            this.forceUpdate();
            tools_logs_1.Logs.measure(measure);
        }
        var _a;
    };
    ViewControllerTabChart.prototype.onCHART_VIEW_CHARTS_UPDATED = function (needsParsing) {
        if (needsParsing === void 0) { needsParsing = true; }
        this.loadSets();
        needsParsing && controller_data_1.dataController.updateForParsers();
        this.onDATA_IS_UPDATED({ rows: controller_data_1.dataController.getRows() }, true);
    };
    ViewControllerTabChart.prototype.onCHART_VIEW_CHARTS_STYLE_UPDATED = function () {
        this.onCHART_VIEW_CHARTS_UPDATED(false);
    };
    ViewControllerTabChart.prototype.getTimestampByIndex = function (index, offset) {
        var result = null;
        if (index >= 0 && index <= this._rows.length - 1) {
            if (this._rows[index].parsed.timestamp instanceof Array && this._rows[index].parsed.timestamp.length > 0) {
                return this._rows[index].parsed.timestamp[0].datetime;
            }
            switch (offset) {
                case OFFSET_DIRECTION.LEFT:
                    return this.getTimestampByIndex(index - 1, offset);
                case OFFSET_DIRECTION.RIGHT:
                    return this.getTimestampByIndex(index + 1, offset);
            }
        }
        else {
        }
        return result;
    };
    ViewControllerTabChart.prototype.onROW_IS_SELECTED = function (index, GUID) {
        if (this.viewParams.GUID !== GUID) {
            if (this.D3 !== null && this._rows instanceof Array) {
                var selected = null;
                selected === null && (selected = this.getTimestampByIndex(index, OFFSET_DIRECTION.LEFT));
                selected === null && (selected = this.getTimestampByIndex(index, OFFSET_DIRECTION.RIGHT));
                if (selected !== null) {
                    this.D3.goToPosition(selected);
                }
            }
        }
    };
    return ViewControllerTabChart;
}(class_tab_controller_1.TabController));
__decorate([
    core_1.ViewChild('svg', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.ViewContainerRef)
], ViewControllerTabChart.prototype, "svg", void 0);
ViewControllerTabChart = __decorate([
    core_1.Component({
        selector: 'view-controller-chart',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ComponentFactoryResolver,
        core_1.ViewContainerRef,
        core_1.ChangeDetectorRef])
], ViewControllerTabChart);
exports.ViewControllerTabChart = ViewControllerTabChart;
//# sourceMappingURL=component.js.map