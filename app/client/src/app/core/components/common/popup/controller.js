"use strict";
var component_1 = require("./component");
var controller_events_1 = require("../../../modules/controller.events");
var controller_config_1 = require("../../../modules/controller.config");
var PopupController = (function () {
    function PopupController() {
    }
    PopupController.prototype.open = function (parameters) {
        var _this = this;
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REQUEST_FOR_ROOT_HOLDER_RESOLVER, function (componentFactoryResolver) {
            //Create factory if it's needed
            if (parameters.content !== void 0 && parameters.content.component !== void 0) {
                parameters.content.factory = componentFactoryResolver.resolveComponentFactory(parameters.content.component);
            }
            //Ask controller to render popup
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.ADD_TO_ROOT_HOLDER, parameters.GUID, componentFactoryResolver.resolveComponentFactory(component_1.Popup), { parameters: parameters }, _this.onInstance.bind(_this));
        });
    };
    PopupController.prototype.close = function (GUID) {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, GUID);
    };
    PopupController.prototype.onInstance = function (instance) {
    };
    return PopupController;
}());
var popupController = new PopupController();
exports.popupController = popupController;
//# sourceMappingURL=controller.js.map