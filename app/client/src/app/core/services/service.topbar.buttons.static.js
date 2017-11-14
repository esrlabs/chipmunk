"use strict";
var StaticTopBarButtonsStorage = (function () {
    function StaticTopBarButtonsStorage() {
        this.shortcuts = [];
    }
    StaticTopBarButtonsStorage.prototype.getItems = function () {
        return this.shortcuts;
    };
    StaticTopBarButtonsStorage.prototype.addButton = function (button) {
        if (button instanceof Array) {
            (_a = this.shortcuts).push.apply(_a, button);
        }
        else {
            this.shortcuts.push(button);
        }
        var _a;
    };
    StaticTopBarButtonsStorage.prototype.removeButton = function (id) {
        var index = this.shortcuts.findIndex(function (button) { return (button.id === id); });
        ~index && this.shortcuts.splice(index, 1);
    };
    StaticTopBarButtonsStorage.prototype.updateButton = function (button) {
        var _this = this;
        var index = this.shortcuts.findIndex(function (_button) { return (_button.id === button.id); });
        if (~index) {
            Object.keys(button).forEach(function (key) {
                _this.shortcuts[index][key] = button[key];
            });
        }
    };
    return StaticTopBarButtonsStorage;
}());
exports.StaticTopBarButtonsStorage = StaticTopBarButtonsStorage;
var staticTopBarButtonsStorage = new StaticTopBarButtonsStorage();
exports.staticTopBarButtonsStorage = staticTopBarButtonsStorage;
//# sourceMappingURL=service.topbar.buttons.static.js.map