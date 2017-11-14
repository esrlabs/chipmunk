"use strict";
var controller_localsettings_1 = require("../modules/controller.localsettings");
var controller_config_1 = require("../modules/controller.config");
var controller_1 = require("../components/common/popup/controller");
var component_1 = require("../components/common/dialogs/themes.list/component");
var component_2 = require("../components/common/dialogs/dialog-message/component");
var ControllerThemes = (function () {
    function ControllerThemes() {
    }
    ControllerThemes.prototype.defaults = function () {
        return controller_config_1.configuration.sets.THEMES.default;
    };
    ControllerThemes.prototype.load = function () {
        var settings = controller_localsettings_1.localSettings.get();
        if (settings !== null && settings[controller_localsettings_1.KEYs.themes] !== void 0 && settings[controller_localsettings_1.KEYs.themes] !== null && settings[controller_localsettings_1.KEYs.themes].current !== void 0) {
            return settings[controller_localsettings_1.KEYs.themes].current;
        }
        else {
            return this.defaults();
        }
    };
    ControllerThemes.prototype.save = function (theme) {
        if (typeof theme === 'string' && theme.trim() !== '') {
            controller_localsettings_1.localSettings.set((_a = {},
                _a[controller_localsettings_1.KEYs.themes] = {
                    current: theme
                },
                _a));
        }
        var _a;
    };
    ControllerThemes.prototype.init = function () {
        var current = this.load();
        var link = document.createElement('LINK');
        link.setAttribute('rel', 'stylesheet');
        link.setAttribute('href', "./app/css/" + current);
        document.head.appendChild(link);
    };
    ControllerThemes.prototype.oneSelectThemeDialog = function () {
        var GUID = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_1.DialogThemesList,
                params: {
                    themes: controller_config_1.configuration.sets.THEMES.LIST,
                    handler: function (GUID, file, settings) {
                        controller_1.popupController.close(GUID);
                        this.save(file);
                        this.confirmRestart();
                    }.bind(this, GUID)
                }
            },
            title: _('Available themes'),
            settings: {
                move: true,
                resize: true,
                width: '20rem',
                height: '10rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: GUID
        });
    };
    ControllerThemes.prototype.confirmRestart = function () {
        var popup = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_2.DialogMessage,
                params: {
                    message: 'To apply changes you should restart application.',
                    buttons: [
                        { caption: 'Yes, restart it', handle: function () { window.location.reload(); controller_1.popupController.close(popup); } },
                        { caption: 'No, do it later it', handle: function () { controller_1.popupController.close(popup); } },
                    ]
                }
            },
            title: _('Confirmation'),
            settings: {
                move: true,
                resize: true,
                width: '30rem',
                height: '10rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: popup
        });
    };
    return ControllerThemes;
}());
var controllerThemes = new ControllerThemes();
exports.controllerThemes = controllerThemes;
//# sourceMappingURL=controller.themes.js.map