"use strict";
var controller_data_parsers_tracker_generator_js_1 = require("./controller.data.parsers.tracker.generator.js");
var controller_data_parsers_tracker_manager_js_1 = require("./controller.data.parsers.tracker.manager.js");
var Parser = (function () {
    function Parser() {
        this.manager = new controller_data_parsers_tracker_manager_js_1.Manager();
        this.sets = null;
        this.sets = this.manager.load();
    }
    Parser.prototype.parseSegmentType = function (str, data, GUID) {
        function apply(income, regsStr, output) {
            regsStr.forEach(function (regStr) {
                var reg = controller_data_parsers_tracker_generator_js_1.generator.getRegExp(regStr), matches = [];
                if (reg !== null) {
                    matches = regStr !== '' ? income.match(reg) : [income];
                    if (matches instanceof Array && matches.length > 0) {
                        matches = matches.filter(function (match) { return match !== ''; });
                        matches.length > 0 && output.push.apply(output, matches);
                    }
                }
            });
            return output;
        }
        ;
        var segments = [], values = [], result = [], key = null;
        //Step 0. Get segments
        segments = apply(str, data.segments, segments);
        //Check cache
        key = controller_data_parsers_tracker_generator_js_1.generator.getKey(GUID, segments);
        result = controller_data_parsers_tracker_generator_js_1.generator.load(key);
        if (result === null) {
            result = [];
            //Step 1. Get values from segments
            segments.forEach(function (segment) {
                apply(segment, data.values, values);
            });
            //Step 2. Clean up values
            values = values.map(function (value) {
                data.clearing.forEach(function (parserRegStr) {
                    value = value.replace(controller_data_parsers_tracker_generator_js_1.generator.getRegExp(parserRegStr), '');
                });
                return value;
            });
            //Step 3. Convert
            result = values.map(function (value) {
                if (data.indexes[value] !== void 0) {
                    return {
                        index: data.indexes[value].index,
                        label: data.indexes[value].label
                    };
                }
                else {
                    return null;
                }
            }).filter(function (item) { return item !== null; });
            //Step 4. Save cache
            result.length > 0 && controller_data_parsers_tracker_generator_js_1.generator.save(key, result);
        }
        return result;
    };
    Parser.prototype.parseKeysType = function (str, data, GUID) {
        var result = [], actual = false, key = '';
        data.tests.forEach(function (test) {
            var reg = controller_data_parsers_tracker_generator_js_1.generator.getRegExp(test);
            !actual && (actual = reg.test(str));
        });
        if (actual) {
            key = controller_data_parsers_tracker_generator_js_1.generator.getKey(GUID, [str]);
            result = controller_data_parsers_tracker_generator_js_1.generator.load(key);
            if (result === null) {
                result = [];
                Object.keys(data.indexes).forEach(function (key) {
                    if (typeof data.indexes[key].value === 'string') {
                        ~str.indexOf(data.indexes[key].value) && result.push({
                            index: data.indexes[key].index,
                            label: data.indexes[key].label
                        });
                    }
                });
                result.length > 0 && controller_data_parsers_tracker_generator_js_1.generator.save(key, result);
            }
        }
        return result;
    };
    Parser.prototype.parseSet = function (str, data, GUID) {
        var result = [];
        if (data.segments instanceof Array) {
            result = this.parseSegmentType(str, data, GUID);
        }
        else if (data.tests instanceof Array) {
            result = this.parseKeysType(str, data, GUID);
        }
        return result;
    };
    Parser.prototype.parse = function (str) {
        var _this = this;
        var result = {};
        if (this.sets !== null && typeof this.sets === 'object') {
            Object.keys(this.sets).forEach(function (GUID) {
                var indexes = _this.parseSet(str, _this.sets[GUID], GUID);
                indexes.length > 0 && (result[GUID] = indexes);
            });
        }
        return Object.keys(result).length > 0 ? result : null;
    };
    return Parser;
}());
exports.Parser = Parser;
//# sourceMappingURL=controller.data.parsers.tracker.js.map