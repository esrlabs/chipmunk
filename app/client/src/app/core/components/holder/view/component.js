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
var class_view_1 = require("../../../services/class.view");
var controllers_list_1 = require("../../../../views/controllers.list");
var controller_events_1 = require("../../../modules/controller.events");
var controller_config_1 = require("../../../modules/controller.config");
var consts_resize_modes_1 = require("../../../consts/consts.resize.modes");
var consts_views_obligatory_actions_1 = require("../../../consts/consts.views.obligatory.actions");
var View = (function () {
    function View(changeDetectorRef) {
        var _this = this;
        this.changeDetectorRef = changeDetectorRef;
        this.resize = null;
        this.cache = {
            x: -1,
            y: -1
        };
        this.dragable = false;
        this.dragover = false;
        this.dragging = false;
        this.params = null;
        this.viewController = null;
        this.onMouseMoveWindow = this.onMouseMoveWindow.bind(this);
        this.onMouseUpWindow = this.onMouseUpWindow.bind(this);
        [controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_DESCRIPTION_MOUSEDOWN,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_DESCRIPTION_MOUSEUP].forEach(function (handle) {
            _this['on' + handle] = _this['on' + handle].bind(_this);
            controller_events_1.events.bind(handle, _this['on' + handle]);
        });
    }
    View.prototype.ngAfterContentInit = function () {
        this.addActionsToMenu();
        this.addFavoriteActions();
        this.addObligatoryMenu();
        this.renderComponent();
    };
    View.prototype.ngAfterViewInit = function () {
    };
    View.prototype.ngOnDestroy = function () {
        var _this = this;
        [controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_DESCRIPTION_MOUSEDOWN,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_DESCRIPTION_MOUSEUP].forEach(function (handle) {
            controller_events_1.events.unbind(handle, _this['on' + handle]);
        });
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.FORGET_FILTER, this.params.GUID);
    };
    View.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    View.prototype.renderComponent = function () {
        this.viewController = {
            component: controllers_list_1.viewsControllersListObj[this.params.controller],
            inputs: {},
            params: { viewParams: this.params },
        };
    };
    View.prototype.addFavoriteActions = function () {
        this.params.favorites.unshift({
            icon: 'fa-bookmark-o',
            mark: null
        });
    };
    View.prototype.getMenuItemBySymbol = function (symbol) {
        var _item = null;
        this.params.menu.forEach(function (item) {
            if (item.symbol !== void 0 && item.symbol === symbol) {
                _item = item;
            }
        });
        return _item;
    };
    View.prototype.toggleItem = function (symbol) {
        var item = this.getMenuItemBySymbol(symbol);
        if (item !== null) {
            item.active = !item.active;
            this.forceUpdate();
        }
    };
    View.prototype.getMenuAction = function (type) {
        switch (type) {
            case consts_views_obligatory_actions_1.ACTIONS.SILENCE:
                return function () {
                    controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_SILENCE_TOGGLE, this.params.GUID);
                    this.toggleItem(consts_views_obligatory_actions_1.ACTIONS.SILENCE);
                }.bind(this);
            case consts_views_obligatory_actions_1.ACTIONS.DEAFNESS:
                return function () {
                    controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_DEAFNESS_TOGGLE, this.params.GUID);
                    this.toggleItem(consts_views_obligatory_actions_1.ACTIONS.DEAFNESS);
                }.bind(this);
            case consts_views_obligatory_actions_1.ACTIONS.FILTER:
                return function () {
                    controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_FILTER_TOGGLE, this.params.GUID);
                    this.toggleItem(consts_views_obligatory_actions_1.ACTIONS.FILTER);
                }.bind(this);
            case consts_views_obligatory_actions_1.ACTIONS.CLOSE:
                return function () {
                    controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REMOVE_VIEW, this.params.GUID);
                }.bind(this);
        }
    };
    View.prototype.addActionsToMenu = function () {
        var _this = this;
        this.params.menu = this.params.menu.map(function (item) {
            var event = item['event'] !== void 0 ? item['event'] : null, listen = item['listen'] !== void 0 ? item['listen'] : null, GUID = _this.params.GUID;
            event !== null && (item['action'] = (function () {
                controller_events_1.events.trigger(event, GUID);
                if (typeof item['active'] === 'boolean') {
                    item['active'] = !item['active'];
                    this.forceUpdate();
                }
            }).bind(_this));
            listen !== null && (controller_events_1.events.bind(listen, (function (_GUID, active) {
                if (_GUID === GUID && typeof item['active'] === 'boolean') {
                    item['active'] = active;
                    this.forceUpdate();
                }
            }).bind(_this)));
            return item;
        });
    };
    View.prototype.addActiveState = function () {
        this.params.menu = this.params.menu.map(function (item) {
            return item;
        });
    };
    View.prototype.addObligatoryMenu = function () {
        if (!~this.params.hide.indexOf(consts_views_obligatory_actions_1.ACTIONS.SILENCE)) {
            this.params.menu.push({
                icon: 'fa-eye-slash',
                symbol: consts_views_obligatory_actions_1.ACTIONS.SILENCE,
                GUID: consts_views_obligatory_actions_1.ACTIONS.SILENCE,
                action: this.getMenuAction(consts_views_obligatory_actions_1.ACTIONS.SILENCE),
                hint: _('Do not make other views change'),
                active: false,
                disable: false
            });
        }
        if (!~this.params.hide.indexOf(consts_views_obligatory_actions_1.ACTIONS.DEAFNESS)) {
            this.params.menu.push({
                icon: 'fa-lock',
                symbol: consts_views_obligatory_actions_1.ACTIONS.DEAFNESS,
                GUID: consts_views_obligatory_actions_1.ACTIONS.DEAFNESS,
                action: this.getMenuAction(consts_views_obligatory_actions_1.ACTIONS.DEAFNESS),
                hint: _('Do not react on changes outside'),
                active: false,
                disable: false
            });
        }
        if (!~this.params.hide.indexOf(consts_views_obligatory_actions_1.ACTIONS.FILTER)) {
            this.params.menu.push({
                icon: 'fa-filter',
                symbol: consts_views_obligatory_actions_1.ACTIONS.FILTER,
                GUID: consts_views_obligatory_actions_1.ACTIONS.FILTER,
                action: this.getMenuAction(consts_views_obligatory_actions_1.ACTIONS.FILTER),
                hint: _('Do not react on filter changes'),
                active: true,
                disable: false
            });
        }
        if (!~this.params.hide.indexOf(consts_views_obligatory_actions_1.ACTIONS.CLOSE)) {
            this.params.menu.push({
                icon: 'fa-times',
                symbol: consts_views_obligatory_actions_1.ACTIONS.CLOSE,
                GUID: consts_views_obligatory_actions_1.ACTIONS.CLOSE,
                action: this.getMenuAction(consts_views_obligatory_actions_1.ACTIONS.CLOSE),
                hint: _('Remove this view'),
                active: false,
                disable: false
            });
        }
    };
    View.prototype.denySelection = function () {
        document.body.className += ' noselect';
    };
    View.prototype.allowSelection = function () {
        document.body.className = document.body.className.replace(' noselect', '');
    };
    View.prototype.attachWindowHandles = function () {
        window.addEventListener('mousemove', this.onMouseMoveWindow);
        window.addEventListener('mouseup', this.onMouseUpWindow);
    };
    View.prototype.detachWindowHandles = function () {
        window.removeEventListener('mousemove', this.onMouseMoveWindow);
        window.removeEventListener('mouseup', this.onMouseUpWindow);
    };
    View.prototype.grabCoordinates = function (event) {
        return {
            x: event.screenX,
            y: event.screenY
        };
    };
    View.prototype.onMouseMoveWindow = function (event) {
        var coords = this.grabCoordinates(event), dX = this.cache.x - coords.x, dY = this.cache.y - coords.y, changed = false;
        switch (this.resize) {
            case consts_resize_modes_1.RESIZE_MODES.TOP:
                dY !== 0 && (changed = true);
                break;
            case consts_resize_modes_1.RESIZE_MODES.BOTTOM:
                dY !== 0 && (changed = true);
                break;
            case consts_resize_modes_1.RESIZE_MODES.LEFT:
                dX !== 0 && (changed = true);
                break;
            case consts_resize_modes_1.RESIZE_MODES.RIGHT:
                dX !== 0 && (changed = true);
                break;
        }
        changed && controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_RESIZE, {
            GUID: this.params.GUID,
            dX: this.cache.x - coords.x,
            dY: this.cache.y - coords.y,
            mode: this.resize
        });
        this.cacheCoordinates(event);
    };
    View.prototype.onMouseUpWindow = function () {
        this.resize = null;
        this.detachWindowHandles();
        this.allowSelection();
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_RESIZE_FINISHED);
    };
    View.prototype.cacheCoordinates = function (event) {
        this.cache = this.grabCoordinates(event);
    };
    View.prototype.onResizeStarted = function () {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_RESIZE_STARTED);
    };
    View.prototype.onMouseDownT = function (event) {
        this.onResizeStarted();
        this.cacheCoordinates(event);
        this.attachWindowHandles();
        this.denySelection();
        this.resize = consts_resize_modes_1.RESIZE_MODES.TOP;
    };
    View.prototype.onMouseDownB = function (event) {
        this.onResizeStarted();
        this.cacheCoordinates(event);
        this.attachWindowHandles();
        this.denySelection();
        this.resize = consts_resize_modes_1.RESIZE_MODES.BOTTOM;
    };
    View.prototype.onMouseDownL = function (event) {
        this.onResizeStarted();
        this.cacheCoordinates(event);
        this.attachWindowHandles();
        this.denySelection();
        this.resize = consts_resize_modes_1.RESIZE_MODES.LEFT;
    };
    View.prototype.onMouseDownR = function (event) {
        this.onResizeStarted();
        this.cacheCoordinates(event);
        this.attachWindowHandles();
        this.denySelection();
        this.resize = consts_resize_modes_1.RESIZE_MODES.RIGHT;
    };
    View.prototype.onDragOver = function (event) {
        this.dragover = true;
        event.preventDefault();
        event.stopPropagation();
    };
    View.prototype.onDragLeave = function (event) {
        this.dragover = false;
    };
    View.prototype.onDrag = function (event) {
        this.dragging = true;
    };
    View.prototype.onDragEnd = function (event) {
        this.dragging = false;
        this.dragable = false;
    };
    View.prototype.onDragStart = function (event) {
        if (!this.dragable) {
            event.preventDefault();
            event.stopPropagation();
        }
        else {
            event.dataTransfer.setData('text/plain', this.params.GUID);
        }
    };
    View.prototype.onDrop = function (event) {
        var GUID = event.dataTransfer.getData('text/plain');
        if (GUID !== this.params.GUID) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_SWITCH_POSITION_BETWEEN, GUID, this.params.GUID);
        }
        this.dragover = false;
    };
    View.prototype.onVIEW_BAR_DESCRIPTION_MOUSEDOWN = function (GUID) {
        this.dragable = (GUID === this.params.GUID);
    };
    View.prototype.onVIEW_BAR_DESCRIPTION_MOUSEUP = function (GUID) {
        this.dragable = false;
    };
    return View;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", class_view_1.ViewClass)
], View.prototype, "params", void 0);
View = __decorate([
    core_1.Component({
        selector: 'view',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], View);
exports.View = View;
//# sourceMappingURL=component.js.map