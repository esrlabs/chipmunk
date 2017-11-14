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
var controller_events_1 = require("../../../modules/controller.events");
var controller_config_1 = require("../../../modules/controller.config");
var consts_views_obligatory_actions_1 = require("../../../consts/consts.views.obligatory.actions");
var ViewBar = (function () {
    function ViewBar(changeDetectorRef) {
        var _this = this;
        this.changeDetectorRef = changeDetectorRef;
        this.menu = [];
        this.favorites = [];
        this.description = '';
        this.viewParams = null;
        this.isFavoriteActive = true;
        [controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_RESPONSE,
            controller_config_1.configuration.sets.EVENTS_VIEWS.VIEW_BAR_ADD_BUTTON,
            controller_config_1.configuration.sets.EVENTS_VIEWS.VIEW_BAR_REMOVE_BUTTON,
            controller_config_1.configuration.sets.EVENTS_VIEWS.VIEW_BAR_ENABLE_BUTTON,
            controller_config_1.configuration.sets.EVENTS_VIEWS.VIEW_BAR_DISABLE_BUTTON].forEach(function (handle) {
            _this['on' + handle] = _this['on' + handle].bind(_this);
            controller_events_1.events.bind(handle, _this['on' + handle]);
        });
    }
    ViewBar.prototype.ngOnDestroy = function () {
        var _this = this;
        [controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_RESPONSE,
            controller_config_1.configuration.sets.EVENTS_VIEWS.VIEW_BAR_ADD_BUTTON,
            controller_config_1.configuration.sets.EVENTS_VIEWS.VIEW_BAR_REMOVE_BUTTON,
            controller_config_1.configuration.sets.EVENTS_VIEWS.VIEW_BAR_ENABLE_BUTTON,
            controller_config_1.configuration.sets.EVENTS_VIEWS.VIEW_BAR_DISABLE_BUTTON].forEach(function (handle) {
            controller_events_1.events.unbind(handle, _this['on' + handle]);
        });
    };
    ViewBar.prototype.ngAfterContentInit = function () {
        this.updateFavoriteState();
    };
    ViewBar.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    ViewBar.prototype.updateFavoriteState = function () {
        if (this.viewParams !== void 0) {
            this.isFavoriteActive = ~this.viewParams.hide.indexOf(consts_views_obligatory_actions_1.ACTIONS.FAVORITE) ? false : true;
        }
    };
    ViewBar.prototype.getButtonIndexByGUID = function (GUID) {
        var index = -1;
        this.menu instanceof Array && this.menu.forEach(function (item, i) {
            if (item['GUID'] !== void 0 && item['GUID'] === GUID) {
                index = i;
            }
        });
        return index;
    };
    ViewBar.prototype.onVIEW_BAR_ADD_FAVORITE_RESPONSE = function (params) {
        if (this.viewParams.GUID === params.GUID) {
            if (this.isFavorite(params.index)) {
                this.removeFavorite(params.index);
            }
            else {
                this.addFavorite(params.index);
            }
            this.forceUpdate();
        }
    };
    ViewBar.prototype.onVIEW_BAR_ADD_BUTTON = function (GUID, button, last, callback) {
        if (last === void 0) { last = false; }
        if (this.viewParams.GUID === GUID) {
            button['GUID'] = button['GUID'] !== void 0 ? button['GUID'] : Symbol();
            if (last) {
                this.menu.splice(this.menu.length - 1, 0, button);
            }
            else {
                this.menu.unshift(button);
            }
            typeof callback === 'function' && callback(button['GUID']);
        }
        else {
            typeof callback === 'function' && callback();
        }
        this.forceUpdate();
    };
    ViewBar.prototype.onVIEW_BAR_REMOVE_BUTTON = function (GUID, buttonGUID, callback) {
        if (this.viewParams.GUID === GUID) {
            var index = this.getButtonIndexByGUID(buttonGUID);
            ~index && this.menu.splice(index, 1);
        }
        this.forceUpdate();
    };
    ViewBar.prototype.onVIEW_BAR_ENABLE_BUTTON = function (GUID, buttonGUID) {
        if (this.viewParams.GUID === GUID) {
            var index = this.getButtonIndexByGUID(buttonGUID);
            ~index && (this.menu[index]['disable'] = false);
        }
        this.forceUpdate();
    };
    ViewBar.prototype.onVIEW_BAR_DISABLE_BUTTON = function (GUID, buttonGUID) {
        if (this.viewParams.GUID === GUID) {
            var index = this.getButtonIndexByGUID(buttonGUID);
            ~index && (this.menu[index]['disable'] = true);
        }
        this.forceUpdate();
    };
    ViewBar.prototype.isFavorite = function (mark) {
        var result = false;
        this.favorites.forEach(function (favorite) {
            mark == favorite.mark && (result = true);
        });
        return result;
    };
    ViewBar.prototype.removeFavorite = function (mark) {
        this.favorites = this.favorites.filter(function (favorite) {
            return favorite.mark != mark;
        });
    };
    ViewBar.prototype.addFavorite = function (mark) {
        this.favorites.push({
            icon: null,
            mark: mark
        });
    };
    ViewBar.prototype.onMenuItemClick = function (index) {
        if (this.menu[index] !== void 0) {
            !this.menu[index]['disable'] && (typeof this.menu[index]['action'] === 'function' && this.menu[index]['action']());
        }
    };
    ViewBar.prototype.onAddFavorite = function (smth) {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_CLICKED, this.viewParams.GUID);
    };
    ViewBar.prototype.onSelectFavorite = function (smth) {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_GOTO, { GUID: this.viewParams.GUID, index: parseInt(smth.mark, 10) });
    };
    ViewBar.prototype.onMouseDown = function (event) {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_DESCRIPTION_MOUSEDOWN, this.viewParams.GUID);
    };
    ViewBar.prototype.onMouseUp = function (event) {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_DESCRIPTION_MOUSEUP, this.viewParams.GUID);
    };
    return ViewBar;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], ViewBar.prototype, "menu", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", Array)
], ViewBar.prototype, "favorites", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ViewBar.prototype, "description", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", class_view_1.ViewClass)
], ViewBar.prototype, "viewParams", void 0);
ViewBar = __decorate([
    core_1.Component({
        selector: 'view-bar',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], ViewBar);
exports.ViewBar = ViewBar;
//# sourceMappingURL=component.js.map