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
var controller_config_1 = require("../../../../modules/controller.config");
var ShortcutsList = (function () {
    function ShortcutsList() {
        this.popupGUID = '';
        this.shortcuts = [];
        this.shortcuts = Object.keys(controller_config_1.configuration.sets.KEYS_SHORTCUTS).map(function (shortcut) {
            var _shortcut = controller_config_1.configuration.sets.KEYS_SHORTCUTS[shortcut];
            return {
                label: _shortcut.action,
                keys: _shortcut.keys.filter(function (key) { return true; })
            };
        });
    }
    return ShortcutsList;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ShortcutsList.prototype, "popupGUID", void 0);
ShortcutsList = __decorate([
    core_1.Component({
        selector: 'shortcuts-list',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [])
], ShortcutsList);
exports.ShortcutsList = ShortcutsList;
//# sourceMappingURL=component.js.map