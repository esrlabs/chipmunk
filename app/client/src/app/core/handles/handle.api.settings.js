"use strict";
var controller_1 = require("../components/common/popup/controller");
var component_1 = require("../components/common/dialogs/api.settings/component");
var ws_connector_1 = require("../ws/ws.connector");
var interface_configuration_sets_system_1 = require("../interfaces/interface.configuration.sets.system");
var controller_events_1 = require("../modules/controller.events");
var controller_config_1 = require("../modules/controller.config");
var APISettings = (function () {
    function APISettings() {
        this.loader = new ws_connector_1.SettingsLoader();
        this.settings = {};
        this.settings = this.loader.load();
    }
    APISettings.prototype.dialog = function () {
        var GUID = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_1.DialogAPISettings,
                params: {
                    serverAPI: this.settings[interface_configuration_sets_system_1.SET_KEYS.API_URL],
                    serverWS: this.settings[interface_configuration_sets_system_1.SET_KEYS.WS_URL],
                    serverWSProtocol: this.settings[interface_configuration_sets_system_1.SET_KEYS.WS_PROTOCOL],
                    serverWSTimeout: this.settings[interface_configuration_sets_system_1.SET_KEYS.WS_RECONNECTION_TIMEOUT],
                    proceed: function (params) {
                        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.WS_SETTINGS_CHANGED, params);
                    }.bind(this),
                    cancel: function () { },
                }
            },
            title: _('Connection to remote service'),
            settings: {
                move: true,
                resize: true,
                width: '40rem',
                height: '35rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: GUID
        });
    };
    return APISettings;
}());
exports.APISettings = APISettings;
//# sourceMappingURL=handle.api.settings.js.map