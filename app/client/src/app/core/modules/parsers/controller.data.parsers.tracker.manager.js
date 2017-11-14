"use strict";
var controller_config_1 = require("../../../core/modules/controller.config");
var controller_events_1 = require("../../../core/modules/controller.events");
var controller_localsettings_1 = require("../../../core/modules/controller.localsettings");
var DEFAULTS = {
    LINE_COLOR: 'rgb(20,20,20)',
    TEXT_COLOR: 'rgb(20,20,20)'
};
exports.DEFAULTS = DEFAULTS;
var SETTINGS = {
    SETs: 'SETs'
};
var Manager = (function () {
    function Manager() {
    }
    Manager.prototype.load = function () {
        var settings = controller_localsettings_1.localSettings.get();
        if (settings[controller_localsettings_1.KEYs.view_charts] !== void 0 && settings[controller_localsettings_1.KEYs.view_charts] !== null && settings[controller_localsettings_1.KEYs.view_charts][SETTINGS.SETs] !== void 0) {
            return Object.assign({}, settings[controller_localsettings_1.KEYs.view_charts][SETTINGS.SETs]);
        }
        else {
            return Object.assign({}, controller_config_1.configuration.sets.VIEW_TRACKER.sets);
        }
    };
    Manager.prototype.save = function (sets, needParsing) {
        if (needParsing === void 0) { needParsing = true; }
        controller_localsettings_1.localSettings.reset(controller_localsettings_1.KEYs.view_charts, 'update');
        controller_localsettings_1.localSettings.set((_a = {},
            _a[controller_localsettings_1.KEYs.view_charts] = (_b = {},
                _b[SETTINGS.SETs] = sets,
                _b),
            _a));
        if (needParsing) {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_VIEWS.CHART_VIEW_CHARTS_UPDATED);
        }
        else {
            controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_VIEWS.CHART_VIEW_CHARTS_STYLE_UPDATED);
        }
        var _a, _b;
    };
    Manager.prototype.update = function (GUID, updated, needParsing) {
        if (needParsing === void 0) { needParsing = true; }
        var sets = this.load();
        if (sets[GUID] !== void 0) {
            sets[GUID] = updated;
            this.save(sets, needParsing);
        }
    };
    Manager.prototype.add = function (set) {
        var sets = this.load();
        if (sets[set.name] === void 0) {
            sets[set.name] = set;
            this.save(sets);
        }
    };
    Manager.prototype.remove = function (GUID) {
        var sets = this.load();
        if (sets[GUID] !== void 0) {
            delete sets[GUID];
            this.save(sets);
        }
    };
    return Manager;
}());
exports.Manager = Manager;
;
//# sourceMappingURL=controller.data.parsers.tracker.manager.js.map