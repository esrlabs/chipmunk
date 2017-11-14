"use strict";
var GUIDGenerator = (function () {
    function GUIDGenerator() {
    }
    GUIDGenerator.prototype.S4 = function () {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    };
    GUIDGenerator.prototype.generate = function () {
        return (this.S4() + this.S4() + "-" + this.S4() + "-4" + this.S4().substr(0, 3) + "-" + this.S4() + "-" + this.S4() + this.S4() + this.S4()).toLowerCase();
    };
    return GUIDGenerator;
}());
var GUID = new GUIDGenerator();
exports.GUID = GUID;
//# sourceMappingURL=tools.guid.js.map