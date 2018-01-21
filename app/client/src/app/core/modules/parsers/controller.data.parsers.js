"use strict";
var controller_data_parsers_timestamp_js_1 = require("./controller.data.parsers.timestamp.js");
var controller_data_parsers_tracker_js_1 = require("./controller.data.parsers.tracker.js");
var Parsers = (function () {
    function Parsers() {
        this.parsers = {
            timestamp: new controller_data_parsers_timestamp_js_1.Timestamp(),
            tracks: new controller_data_parsers_tracker_js_1.Parser()
        };
    }
    Parsers.prototype.parse = function (str) {
        var _this = this;
        var result = {};
        Object.keys(this.parsers).forEach(function (parser) {
            result[parser] = _this.parsers[parser].parse(str);
        });
        return result;
    };
    return Parsers;
}());
exports.Parsers = Parsers;
//# sourceMappingURL=controller.data.parsers.js.map