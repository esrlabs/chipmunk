"use strict";
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
var tools_guid_1 = require("../modules/tools.guid");
var controller_events_1 = require("../modules/controller.events");
var controller_config_1 = require("../modules/controller.config");
var controller_localsettings_1 = require("../modules/controller.localsettings");
var tools_logs_1 = require("../modules/tools.logs");
var consts_resize_modes_1 = require("../consts/consts.resize.modes");
var DefaultsLoader = (function () {
    function DefaultsLoader() {
    }
    DefaultsLoader.prototype.getDefaults = function () {
        var views_settings = controller_config_1.configuration.sets.VIEWS_DEFAULTS.map(function (view) {
            return Object.assign({}, view);
        });
        return views_settings;
    };
    DefaultsLoader.prototype.load = function () {
        var local = controller_localsettings_1.localSettings.get();
        if (local[controller_localsettings_1.KEYs.views] !== null) {
            return this.isValid(local[controller_localsettings_1.KEYs.views].settings) ? local[controller_localsettings_1.KEYs.views].settings : this.getDefaults();
        }
        else {
            var views_settings = this.getDefaults();
            controller_localsettings_1.localSettings.set((_a = {},
                _a[controller_localsettings_1.KEYs.views] = {
                    settings: views_settings
                },
                _a));
            return views_settings;
        }
        var _a;
    };
    DefaultsLoader.prototype.save = function (current) {
        controller_localsettings_1.localSettings.set((_a = {},
            _a[controller_localsettings_1.KEYs.views] = {
                settings: current.map(function (view) {
                    return {
                        "id": view.id,
                        "size": {
                            "width": view.size.width,
                            "height": view.size.height
                        },
                        "position": {
                            "top": view.position.top,
                            "left": view.position.left
                        },
                        "row": view.row,
                        "column": view.column
                    };
                })
            },
            _a));
        var _a;
    };
    DefaultsLoader.prototype.isValid = function (views_settings) {
        var result = true, test = /[^\d\.%\-]/gi;
        views_settings.forEach(function (view) {
            if (typeof view.size.width === 'string' && typeof view.size.height === 'string' &&
                typeof view.position.top === 'string' && typeof view.position.left === 'string') {
                if (~view.size.width.search(test) || ~view.size.height.search(test) || ~view.position.top.search(test) || ~view.position.left.search(test)) {
                    result = false;
                }
            }
            else {
                result = false;
            }
        });
        return result;
    };
    return DefaultsLoader;
}());
var Calculator = (function () {
    function Calculator() {
        this.width = -1;
        this.height = -1;
        this.rows = -1;
        this.columns = -1;
        this._columns = -1;
        this.count = -1;
        this.sizeGetter = null;
        this.emitter = new core_1.EventEmitter();
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.HOLDER_VIEWS_RESIZE, this.onHolderResize.bind(this));
    }
    Calculator.prototype.isSizeValid = function () {
        return this.height > 0 ? (this.width > 0 ? true : false) : false;
    };
    Calculator.prototype.recheckSize = function () {
        if (!this.isSizeValid() && typeof this.sizeGetter === 'function') {
            this.onHolderResize(this.sizeGetter(), null);
        }
    };
    Calculator.prototype.onHolderResize = function (size, sizeGetter) {
        this.height = size.height;
        this.width = size.width;
        typeof sizeGetter === 'function' && (this.sizeGetter = sizeGetter);
        this.isSizeValid() && this.emitter.emit();
    };
    Calculator.prototype.reset = function (views) {
        views = views.map(function (view) {
            view.size.width = null;
            view.size.height = null;
            view.position.left = null;
            view.position.top = null;
            return view;
        });
        return views;
    };
    Calculator.prototype.getStateCopy = function (view) {
        return {
            top: view.position.top,
            left: view.position.left,
            width: view.size.width,
            height: view.size.height
        };
    };
    Calculator.prototype.updateState = function (view, state) {
        if (view.position.top !== state.top || view.position.left !== state.left || view.size.width !== state.width || view.size.height !== state.height) {
            view.__updated = true;
        }
        return view;
    };
    Calculator.prototype.percentX = function (px) {
        this.recheckSize();
        return (100 / this.width) * px;
    };
    Calculator.prototype.percentY = function (px) {
        this.recheckSize();
        return (100 / this.height) * px;
    };
    Calculator.prototype.recalculateBasic = function (views) {
        this.columns = Math.round(Math.sqrt(views.length));
        this.rows = Math.ceil(views.length / this.columns);
        this._columns = views.length - (this.rows - 1) * this.columns;
        this.count = views.length;
    };
    Calculator.prototype.recalculate = function (views) {
        if (this.isRecalculationNeeded(views)) {
            return this.calculate(views);
        }
        else {
            this.recalculateBasic(views);
            return views;
        }
    };
    Calculator.prototype.isRecalculationNeeded = function (views) {
        var result = false;
        if (views.length !== this.count && this.count !== -1) {
            result = true;
        }
        else {
            views.forEach(function (view) {
                if (!result) {
                    view.position.left === -1 && (result = true);
                    view.position.top === -1 && (result = true);
                    view.size.width === -1 && (result = true);
                    view.size.height === -1 && (result = true);
                    view.row === -1 && (result = true);
                    view.column === -1 && (result = true);
                }
            });
        }
        return result;
    };
    Calculator.prototype.calculate = function (views) {
        var _this = this;
        this.recheckSize();
        this.recalculateBasic(views);
        var columns = this.columns, rows = this.rows, column = 0, row = 0, top = 0, top_step = this.height / rows, left = 0, count = views.length;
        views = views.map(function (view, index) {
            var in_column = (count - index) >= columns ? columns : (count - (rows - 1) * columns), left_step = _this.width / in_column, state = _this.getStateCopy(view);
            view.position.left = _this.percentX(left) + '%';
            view.position.top = _this.percentY(top) + '%';
            view.size.width = _this.percentX(_this.width / in_column) + '%';
            view.size.height = _this.percentY(_this.height / rows) + '%';
            view.row = row;
            view.column = column;
            column += 1;
            if (column === columns) {
                column = 0;
                row += 1;
                top += top_step;
                left = 0;
            }
            else {
                left += left_step;
            }
            return _this.updateState(view, state);
        });
        return views;
    };
    Calculator.prototype.resizeHeightTop = function (views, row, column, dY) {
        var _this = this;
        return views.map(function (view) {
            var state = _this.getStateCopy(view);
            if (view.row === row - 1 || view.row === row) {
                var height = parseFloat(view.size.height), top_1 = -1;
                if (view.row < row) {
                    view.size.height = (height - _this.percentY(dY)) + '%';
                }
                if (view.row === row) {
                    top_1 = parseFloat(view.position.top);
                    view.position.top = (top_1 - _this.percentY(dY)) + '%';
                    view.size.height = (height + _this.percentY(dY)) + '%';
                }
            }
            return _this.updateState(view, state);
        });
    };
    Calculator.prototype.resizeHeightBottom = function (views, row, column, dY) {
        var _this = this;
        return views.map(function (view) {
            var state = _this.getStateCopy(view);
            if (view.row === row + 1 || view.row === row) {
                var height = parseFloat(view.size.height), top_2 = -1;
                if (view.row === row) {
                    view.size.height = (height - _this.percentY(dY)) + '%';
                }
                if (view.row > row) {
                    top_2 = parseFloat(view.position.top);
                    view.size.height = (height + _this.percentY(dY)) + '%';
                    view.position.top = (top_2 - _this.percentY(dY)) + '%';
                }
            }
            return _this.updateState(view, state);
        });
    };
    Calculator.prototype.resizeWidthLeft = function (views, row, column, dX) {
        var _this = this;
        return views.map(function (view) {
            function apply() {
                if (view.column === column) {
                    width = parseFloat(view.size.width);
                    left = parseFloat(view.position.left);
                    view.size.width = (width + this.percentX(dX)) + '%';
                    view.position.left = (left - this.percentX(dX)) + '%';
                }
                if (view.column < column) {
                    width = parseFloat(view.size.width);
                    view.size.width = (width - this.percentX(dX)) + '%';
                }
            }
            ;
            var width = -1, left = -1, state = _this.getStateCopy(view);
            if (view.column === column - 1 || view.column === column) {
                if (_this._columns === _this.columns) {
                    apply.call(_this);
                }
                else {
                    if (row === _this.rows - 1) {
                        view.row === _this.rows - 1 && apply.call(_this);
                    }
                    else {
                        view.row !== _this.rows - 1 && apply.call(_this);
                    }
                }
            }
            return _this.updateState(view, state);
        });
    };
    Calculator.prototype.resizeWidthRight = function (views, row, column, dX) {
        var _this = this;
        return views.map(function (view) {
            function apply() {
                if (view.column === column) {
                    width = parseFloat(view.size.width);
                    view.size.width = (width - this.percentX(dX)) + '%';
                }
                if (view.column > column) {
                    width = parseFloat(view.size.width);
                    left = parseFloat(view.position.left);
                    view.size.width = (width + this.percentX(dX)) + '%';
                    view.position.left = (left - this.percentX(dX)) + '%';
                }
            }
            ;
            var width = -1, left = -1, state = _this.getStateCopy(view);
            if (view.column === column + 1 || view.column === column) {
                if (_this._columns === _this.columns) {
                    apply.call(_this);
                }
                else {
                    if (row === _this.rows - 1) {
                        view.row === _this.rows - 1 && apply.call(_this);
                    }
                    else {
                        view.row !== _this.rows - 1 && apply.call(_this);
                    }
                }
            }
            return _this.updateState(view, state);
        });
    };
    Calculator.prototype.resize = function (views, target, event) {
        switch (event.mode) {
            case consts_resize_modes_1.RESIZE_MODES.TOP:
                return this.resizeHeightTop(views, target.row, target.column, event.dY);
            case consts_resize_modes_1.RESIZE_MODES.BOTTOM:
                return this.resizeHeightBottom(views, target.row, target.column, event.dY);
            case consts_resize_modes_1.RESIZE_MODES.LEFT:
                return this.resizeWidthLeft(views, target.row, target.column, event.dX);
            case consts_resize_modes_1.RESIZE_MODES.RIGHT:
                return this.resizeWidthRight(views, target.row, target.column, event.dX);
        }
        return views;
    };
    Calculator.prototype.beforeUpdate = function (views) {
        return views.map(function (view) {
            view.__updated = false;
            return view;
        });
    };
    Calculator.prototype.afterUpdate = function (views) {
        return views.map(function (view) {
            view.__updated && view.forceUpdateContent();
            view.__updated = false;
            return view;
        });
    };
    return Calculator;
}());
var ServiceViews = (function () {
    function ServiceViews() {
        /*
         public data: Array<any> = [
         {
         id          : 'view_1',
         GUID        : GUID.generate(),
         name        : 'View #1',
         description : 'List of logs records',
         weight      : 0.5,
         vertical    : false,
         horizontal  : true,
         favorites   : [],
         menu        : [
         //{ icon : 'fa-angle-double-left'},
         //{ icon : 'fa-angle-double-right'},
         ],
         controller  : 'ViewControllerList',
         size        : {
         width   : '100%',
         height  : '50%'
         },
         position    : {
         top     : 0,
         left    : 0
         }
         },
         {
         id          : 'view_2',
         GUID        : GUID.generate(),
         name        : 'View #2',
         description : 'Events tracker',
         weight      : 0.5,
         vertical    : false,
         horizontal  : true,
         favorites   : [],
         menu        : [
         ],
         controller  : 'ViewControllerChart',
         size        : {
         width   : '100%',
         height  : '50%'
         },
         position    : {
         top     : '50%',
         left    : 0
         }
         },
         ];
         */
        this.loader = new DefaultsLoader();
        this.calculator = new Calculator();
        this.defaults = null;
        this.views = Object.assign({}, controller_config_1.configuration.sets.VIEWS);
        this.current = [];
        this.defaults = this.loader.load();
        this.convert();
        this.addRefreshHandles();
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_RESIZE, this.onVIEW_RESIZE.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_RESIZE_STARTED, this.onVIEW_RESIZE_STARTED.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_RESIZE_FINISHED, this.onVIEW_RESIZE_FINISHED.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.REMOVE_VIEW, this.onREMOVE_VIEW.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.ADD_VIEW, this.onADD_VIEW.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_SWITCH_POSITION_BETWEEN, this.onVIEW_SWITCH_POSITION_BETWEEN.bind(this));
        this.calculator.emitter.subscribe(this.onRecalculate.bind(this));
    }
    ServiceViews.prototype.onREMOVE_VIEW = function (GUID) {
        var index = this.getViewByGUID(GUID).index;
        if (~index) {
            this.current.splice(index, 1);
            this.refreshViews();
        }
    };
    ServiceViews.prototype.onADD_VIEW = function (ID) {
        var view = this.getDefaultView(ID);
        if (view !== null) {
            this.current.push(view);
            this.addRefreshHandles();
            this.refreshViews();
        }
    };
    ServiceViews.prototype.refreshViews = function () {
        this.current = this.calculator.recalculate(this.current);
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEWS_COLLECTION_UPDATED);
        this.loader.save(this.current);
    };
    ServiceViews.prototype.onRecalculate = function (offsets) {
    };
    ServiceViews.prototype.getViewByGUID = function (GUID) {
        var view = null, index = -1;
        this.current.forEach(function (_view, i) {
            if (_view.GUID === GUID) {
                view = _view;
                index = i;
            }
        });
        return {
            view: view,
            index: index
        };
    };
    ServiceViews.prototype.onVIEW_RESIZE = function (event) {
        var view = this.getViewByGUID(event.GUID).view;
        if (view !== void 0) {
            if ((event.mode === consts_resize_modes_1.RESIZE_MODES.TOP && view.row === 0) || (event.mode === consts_resize_modes_1.RESIZE_MODES.BOTTOM && view.row === this.calculator.rows - 1) ||
                (event.mode === consts_resize_modes_1.RESIZE_MODES.LEFT && view.column === 0) || (event.mode === consts_resize_modes_1.RESIZE_MODES.RIGHT && view.column === this.calculator.columns - 1)) {
                return false;
            }
            else {
                this.current = this.calculator.resize(this.current, view, event);
            }
        }
    };
    ServiceViews.prototype.onVIEW_RESIZE_STARTED = function () {
        this.current = this.calculator.beforeUpdate(this.current);
    };
    ServiceViews.prototype.onVIEW_RESIZE_FINISHED = function () {
        this.current = this.calculator.afterUpdate(this.current);
        this.loader.save(this.current);
    };
    ServiceViews.prototype.onVIEW_SWITCH_POSITION_BETWEEN = function (GUID_A, GUID_B) {
        function change(trg, src) {
            trg.row = src.row;
            trg.column = src.column;
            trg.size.width = src.size.width;
            trg.size.height = src.size.height;
            trg.position.top = src.position.top;
            trg.position.left = src.position.left;
        }
        var A = this.getViewByGUID(GUID_A).view, B = this.getViewByGUID(GUID_B).view;
        if (A !== null && B !== null) {
            var _A = {
                row: A.row,
                column: A.column,
                size: {
                    width: A.size.width,
                    height: A.size.height,
                },
                position: {
                    top: A.position.top,
                    left: A.position.left,
                }
            };
            change(A, B);
            change(B, _A);
        }
        this.loader.save(this.current);
    };
    ServiceViews.prototype.validateMenu = function (items) {
        return items.map(function (item) {
            item['GUID'] === void 0 && (item['GUID'] = Symbol());
            item['disable'] === void 0 && (item['disable'] = false);
            return item;
        });
    };
    ServiceViews.prototype.getDefaultView = function (ID) {
        if (this.views[ID] !== void 0) {
            var _view = this.views[ID];
            return {
                id: ID,
                GUID: tools_guid_1.GUID.generate(),
                name: _view.name,
                description: _view.description,
                row: -1,
                column: -1,
                weight: _view.weight,
                vertical: _view.vertical,
                horizontal: _view.horizontal,
                menu: _view.menu instanceof Array ? this.validateMenu(_view.menu.map(function (item) { return Object.assign({}, item); })) : [],
                hide: _view.hide instanceof Array ? _view.hide.map(function (item) { return item; }) : [],
                favorites: true ? [] : [1],
                controller: _view.controller,
                size: {
                    width: -1,
                    height: -1,
                },
                position: {
                    top: -1,
                    left: -1,
                }
            };
        }
        else {
            return null;
        }
    };
    ServiceViews.prototype.convert = function () {
        var _this = this;
        if (this.defaults instanceof Array) {
            this.current = this.defaults.map(function (view) {
                if (_this.views[view.id] !== void 0) {
                    var _view = _this.views[view.id];
                    return {
                        id: view.id,
                        GUID: tools_guid_1.GUID.generate(),
                        name: _view.name,
                        description: _view.description,
                        row: view.row === void 0 ? -1 : view.row,
                        column: view.column === void 0 ? -1 : view.column,
                        weight: _view.weight,
                        vertical: _view.vertical,
                        horizontal: _view.horizontal,
                        menu: _view.menu instanceof Array ? _this.validateMenu(_view.menu.map(function (item) { return Object.assign({}, item); })) : [],
                        hide: _view.hide instanceof Array ? _view.hide.map(function (item) { return item; }) : [],
                        favorites: [],
                        controller: _view.controller,
                        size: {
                            width: view.size.width,
                            height: view.size.height,
                        },
                        position: {
                            top: view.position.top,
                            left: view.position.left,
                        }
                    };
                }
                else {
                    var msg = 'Unexpected error. Settings of views has description of view: "' + view.id + '", but cannot find basic description of this view in settings (./config/views.json).';
                    tools_logs_1.Logs.msg(msg, tools_logs_1.TYPES.ERROR);
                    throw new Error(msg);
                }
            });
            this.current = this.calculator.recalculate(this.current);
        }
        else {
            this.current = [];
        }
    };
    ServiceViews.prototype.addRefreshHandles = function () {
        this.current instanceof Array && (this.current = this.current.map(function (view) {
            view.forceUpdateContent === void 0 && (view.forceUpdateContent = (function () {
                controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_FORCE_UPDATE_CONTENT, this.GUID);
            }.bind(view)));
            return view;
        }));
    };
    ServiceViews.prototype.getViews = function () {
        return this.current;
    };
    return ServiceViews;
}());
ServiceViews = __decorate([
    core_1.Injectable(),
    __metadata("design:paramtypes", [])
], ServiceViews);
exports.ServiceViews = ServiceViews;
//# sourceMappingURL=service.views.js.map