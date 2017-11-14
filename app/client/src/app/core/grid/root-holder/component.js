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
var controller_events_1 = require("../../../core/modules/controller.events");
var controller_config_1 = require("../../../core/modules/controller.config");
var RootHolder = (function () {
    function RootHolder(componentFactoryResolver) {
        this.componentFactoryResolver = componentFactoryResolver;
        this.eventsController = new controller_events_1.EventsController();
        this.refs = {};
        this.eventsController.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.REQUEST_FOR_ROOT_HOLDER_RESOLVER, this.onREQUEST_FOR_ROOT_HOLDER_RESOLVER.bind(this));
        this.eventsController.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.ADD_TO_ROOT_HOLDER, this.onADD_TO_ROOT_HOLDER.bind(this));
        this.eventsController.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, this.onREMOVE_FROM_ROOT_HOLDER.bind(this));
    }
    RootHolder.prototype.ngOnDestroy = function () {
        this.eventsController.kill();
        this.eventsController = null;
    };
    RootHolder.prototype.onREQUEST_FOR_ROOT_HOLDER_RESOLVER = function (callback) {
        callback(this.componentFactoryResolver);
    };
    RootHolder.prototype.onADD_TO_ROOT_HOLDER = function (GUID, factory, params, callback) {
        var component = this.placeholder.createComponent(factory);
        if (typeof params === 'object' && params !== null) {
            Object.keys(params).forEach(function (key) {
                component.instance[key] = params[key];
            });
        }
        if (component.instance.closer !== void 0) {
            component.instance.closer.subscribe(function () {
                component.destroy();
            });
        }
        this.refs[GUID] = component;
        typeof callback === 'function' && callback(component.instance);
    };
    RootHolder.prototype.onREMOVE_FROM_ROOT_HOLDER = function (GUID) {
        if (this.refs[GUID] !== void 0) {
            this.refs[GUID].destroy();
        }
    };
    return RootHolder;
}());
__decorate([
    core_1.ViewChild('placeholder', { read: core_1.ViewContainerRef }),
    __metadata("design:type", core_1.ViewContainerRef)
], RootHolder.prototype, "placeholder", void 0);
RootHolder = __decorate([
    core_1.Component({
        selector: 'root-holder',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ComponentFactoryResolver])
], RootHolder);
exports.RootHolder = RootHolder;
//# sourceMappingURL=component.js.map