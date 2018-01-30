"use strict";
var controller_config_1 = require("../modules/controller.config");
var controller_events_1 = require("../modules/controller.events");
var controller_1 = require("../components/common/popup/controller");
var component_1 = require("../components/common/dialogs/shortcuts.list/component");
var topbar_menu_hadles_1 = require("../handles/topbar.menu.hadles");
var ShortcutController = (function () {
    function ShortcutController() {
        var _this = this;
        this.delay = 200;
        this.keys = [];
        this.timer = null;
        this.listening = true;
        this.delayed = [];
        document.addEventListener('keypress', this.onKeyPress.bind(this));
        this.accept = this.accept.bind(this);
        [controller_config_1.configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_HELP,
            controller_config_1.configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_OPEN_FILE,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_ON,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_OFF
        ].forEach(function (handle) {
            _this['on' + handle] = _this['on' + handle].bind(_this);
            controller_events_1.events.bind(handle, _this['on' + handle]);
        });
        this.getDelayed();
    }
    ShortcutController.prototype.destroy = function () {
        var _this = this;
        [controller_config_1.configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_HELP,
            controller_config_1.configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_OPEN_FILE,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_ON,
            controller_config_1.configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_OFF
        ].forEach(function (handle) {
            controller_events_1.events.unbind(handle, _this['on' + handle]);
        });
    };
    ShortcutController.prototype.getDelayed = function () {
        var _this = this;
        var RULES = controller_config_1.configuration.sets.KEYS_SHORTCUTS;
        Object.keys(RULES).forEach(function (key) {
            RULES[key].keys.length > 1 && _this.delayed.push(RULES[key].keys[0].key);
        });
    };
    ShortcutController.prototype.onSHORTCUTS_SILENCE_ON = function () {
        this.listening = false;
    };
    ShortcutController.prototype.onSHORTCUTS_SILENCE_OFF = function () {
        this.listening = true;
    };
    ShortcutController.prototype.onKeyPress = function (event) {
        if (this.listening) {
            var multiple = this.keys.length === 0 ? (~this.delayed.indexOf(event.key) ? true : false) : true;
            this.keys.push({
                key: event.key,
                code: event.keyCode,
                ctrl: event.ctrlKey,
                shift: event.shiftKey,
                alt: event.altKey
            });
            this.timer !== null && clearTimeout(this.timer);
            if (multiple) {
                this.timer = setTimeout(this.accept, this.delay);
            }
            else {
                this.accept();
            }
        }
    };
    ShortcutController.prototype.isKeyIn = function (key) {
        var result = false;
        this.keys.forEach(function (_key) {
            var res = true;
            Object.keys(key).forEach(function (prop) {
                if (_key[prop] === void 0 || _key[prop] !== key[prop]) {
                    res = false;
                }
            });
            res && (result = true);
        });
        return result;
    };
    ShortcutController.prototype.accept = function () {
        var _this = this;
        if (this.keys.length > 0) {
            var sets_1 = null, RULES_1 = controller_config_1.configuration.sets.KEYS_SHORTCUTS;
            Object.keys(RULES_1).forEach(function (event) {
                if (sets_1 === null) {
                    sets_1 = {
                        rules: RULES_1[event],
                        event: event
                    };
                    RULES_1[event].keys.forEach(function (key) {
                        !_this.isKeyIn(key) && (sets_1 = null);
                    });
                }
            });
            if (sets_1 !== null) {
                if (sets_1.rules.asynch !== void 0 && sets_1.rules.asynch) {
                    setTimeout(function () {
                        controller_events_1.events.trigger(sets_1.event);
                    }, 10);
                }
                else {
                    controller_events_1.events.trigger(sets_1.event);
                }
            }
            this.keys = [];
        }
    };
    ShortcutController.prototype.onSHORTCUT_HELP = function () {
        var popupGUID = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_1.ShortcutsList,
                params: {
                    popupGUID: popupGUID
                }
            },
            title: _('Shortcuts map'),
            settings: {
                move: true,
                resize: true,
                width: '30rem',
                height: '20rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: popupGUID
        });
    };
    ShortcutController.prototype.onSHORTCUT_OPEN_FILE = function () {
        topbar_menu_hadles_1.topbarMenuHandles.openLocalFile();
    };
    return ShortcutController;
}());
exports.ShortcutController = ShortcutController;
//# sourceMappingURL=controller.shortcut.js.map