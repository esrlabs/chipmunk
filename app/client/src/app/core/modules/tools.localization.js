"use strict";
var LOCALE = '_';
exports.LOCALE = LOCALE;
var Locale = (function () {
    function Locale() {
    }
    Locale.prototype.register = function () {
        window[LOCALE] = this.translate.bind(this);
    };
    Locale.prototype.init = function (callback) {
        this.register();
        callback();
    };
    Locale.prototype.translate = function (str) {
        if (str === void 0) { str = ''; }
        return str;
    };
    return Locale;
}());
var locale = new Locale();
exports.locale = locale;
//# sourceMappingURL=tools.localization.js.map