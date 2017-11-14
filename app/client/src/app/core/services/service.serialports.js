"use strict";
var controller_events_1 = require("../../core/modules/controller.events");
var controller_config_1 = require("../../core/modules/controller.config");
var handle_open_serial_stream_1 = require("../handles/handle.open.serial.stream");
var SerialPorts = (function () {
    function SerialPorts() {
        this.id = null;
        this.API_GUID_IS_ACCEPTED = this.API_GUID_IS_ACCEPTED.bind(this);
        this.WS_DISCONNECTED = this.WS_DISCONNECTED.bind(this);
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.API_GUID_IS_ACCEPTED, this.API_GUID_IS_ACCEPTED);
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED, this.WS_DISCONNECTED);
    }
    SerialPorts.prototype.API_GUID_IS_ACCEPTED = function () {
        if (this.id === null) {
            this.id = Symbol();
            controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_TOOLBAR.ADD_BUTTON, {
                id: this.id,
                icon: 'fa fa-plug',
                caption: 'Serial Ports',
                handle: this.openSerialList.bind(this)
            });
        }
    };
    SerialPorts.prototype.WS_DISCONNECTED = function () {
        if (this.id !== null) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_TOOLBAR.REMOVE_BUTTON, this.id);
            this.id = null;
        }
    };
    SerialPorts.prototype.openSerialList = function () {
        var openSerialStream = new handle_open_serial_stream_1.OpenSerialStream();
        openSerialStream.start();
    };
    return SerialPorts;
}());
exports.SerialPorts = SerialPorts;
//# sourceMappingURL=service.serialports.js.map