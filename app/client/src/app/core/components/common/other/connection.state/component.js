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
var controller_events_1 = require("../../../../modules/controller.events");
var controller_config_1 = require("../../../../modules/controller.config");
var ConnectionState = (function () {
    function ConnectionState(changeDetectorRef) {
        var _this = this;
        this.changeDetectorRef = changeDetectorRef;
        this.label = true;
        this.connected = false;
        this.onWS_STATE_CHANGED = this.onWS_STATE_CHANGED.bind(this);
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.WS_STATE_CHANGED, this.onWS_STATE_CHANGED);
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.WS_STATE_GET, function (connected) {
            _this.connected = connected;
            //this.forceUpdate();
        });
    }
    ConnectionState.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    ConnectionState.prototype.ngOnDestroy = function () {
        controller_events_1.events.unbind(controller_config_1.configuration.sets.SYSTEM_EVENTS.WS_STATE_CHANGED, this.onWS_STATE_CHANGED);
    };
    ConnectionState.prototype.onWS_STATE_CHANGED = function (connected) {
        this.connected = connected;
        this.forceUpdate();
    };
    return ConnectionState;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Boolean)
], ConnectionState.prototype, "label", void 0);
ConnectionState = __decorate([
    core_1.Component({
        selector: 'connection-state',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], ConnectionState);
exports.ConnectionState = ConnectionState;
//# sourceMappingURL=component.js.map