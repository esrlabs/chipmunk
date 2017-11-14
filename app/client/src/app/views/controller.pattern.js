"use strict";
var core_1 = require("@angular/core");
var controller_events_1 = require("../core/modules/controller.events");
var controller_config_1 = require("../core/modules/controller.config");
var ViewControllerPattern = (function () {
    function ViewControllerPattern() {
        this.GUID = null;
        this.state = {
            silence: false,
            deafness: false,
            favorites: true,
            filter: true
        };
        this.emitters = {
            silence: new core_1.EventEmitter(),
            deafness: new core_1.EventEmitter(),
            favorites: new core_1.EventEmitter(),
            filter: new core_1.EventEmitter(),
            favoriteClick: new core_1.EventEmitter(),
            favoriteGOTO: new core_1.EventEmitter(),
            resize: new core_1.EventEmitter()
        };
        this.flags = {
            resize: false
        };
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_SILENCE_TOGGLE, this.onVIEW_BAR_SILENCE_TOGGLE.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_DEAFNESS_TOGGLE, this.onVIEW_BAR_DEAFNESS_TOGGLE.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_FAVORITE_TOGGLE, this.onVIEW_BAR_FAVORITE_TOGGLE.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_FILTER_TOGGLE, this.onVIEW_BAR_FILTER_TOGGLE.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_CLICKED, this.onVIEW_BAR_ADD_FAVORITE_CLICKED.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_GOTO, this.onVIEW_BAR_ADD_FAVORITE_GOTO.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.REMOVE_VIEW, this.onREMOVE_VIEW.bind(this));
    }
    ViewControllerPattern.prototype.ngAfterViewChecked = function () {
        if (this.flags.resize) {
            this.flags.resize = false;
            this.emitters.resize.emit();
        }
    };
    ViewControllerPattern.prototype.setGUID = function (GUID) {
        this.GUID = GUID;
    };
    ViewControllerPattern.prototype.getState = function () {
        return this.state;
    };
    ViewControllerPattern.prototype.getEmitters = function () {
        return this.emitters;
    };
    ViewControllerPattern.prototype.onVIEW_BAR_SILENCE_TOGGLE = function (GUID) {
        this.GUID === GUID && (this.state.silence = !this.state.silence);
        this.GUID === GUID && this.emitters.silence.emit(this.state.silence);
    };
    ViewControllerPattern.prototype.onVIEW_BAR_DEAFNESS_TOGGLE = function (GUID) {
        this.GUID === GUID && (this.state.deafness = !this.state.deafness);
        this.GUID === GUID && this.emitters.deafness.emit(this.state.deafness);
    };
    ViewControllerPattern.prototype.onVIEW_BAR_FAVORITE_TOGGLE = function (GUID) {
        this.GUID === GUID && (this.state.favorites = !this.state.favorites);
        this.GUID === GUID && this.emitters.favorites.emit(this.state.favorites);
    };
    ViewControllerPattern.prototype.onVIEW_BAR_FILTER_TOGGLE = function (GUID) {
        if (this.GUID === GUID) {
            this.state.filter = !this.state.filter;
            this.emitters.filter.emit(this.state.filter);
            if (!this.state.filter) {
                controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REMEMBER_FILTER, this.GUID);
            }
            else {
                controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.FORGET_FILTER, this.GUID);
            }
        }
    };
    ViewControllerPattern.prototype.onVIEW_BAR_ADD_FAVORITE_CLICKED = function (GUID) {
        this.GUID === GUID && this.emitters.favoriteClick.emit(GUID);
    };
    ViewControllerPattern.prototype.onVIEW_BAR_ADD_FAVORITE_GOTO = function (event) {
        this.GUID === event.GUID && this.emitters.favoriteGOTO.emit(event);
    };
    ViewControllerPattern.prototype.onREMOVE_VIEW = function (GUID) {
        this.GUID !== GUID && (this.flags.resize = true);
    };
    return ViewControllerPattern;
}());
exports.ViewControllerPattern = ViewControllerPattern;
//# sourceMappingURL=controller.pattern.js.map