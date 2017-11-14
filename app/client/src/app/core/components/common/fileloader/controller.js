"use strict";
var component_1 = require("./component");
var controller_events_1 = require("../../../modules/controller.events");
var controller_config_1 = require("../../../modules/controller.config");
var FileLoaderController = (function () {
    function FileLoaderController() {
    }
    FileLoaderController.prototype.open = function (GUID, handles) {
        var _this = this;
        this.handles = handles;
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REQUEST_FOR_ROOT_HOLDER_RESOLVER, function (componentFactoryResolver) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.ADD_TO_ROOT_HOLDER, GUID, componentFactoryResolver.resolveComponentFactory(component_1.FileLoader), {}, _this.onInstance.bind(_this));
        });
    };
    FileLoaderController.prototype.onInstance = function (instance) {
        instance.open(this.handles);
    };
    return FileLoaderController;
}());
var fileLoaderController = new FileLoaderController();
exports.fileLoaderController = fileLoaderController;
//# sourceMappingURL=controller.js.map