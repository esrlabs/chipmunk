"use strict";
var tools_logs_1 = require("./tools.logs");
var controller_events_1 = require("./controller.events");
var controller_config_1 = require("./controller.config");
var interface_data_row_1 = require("../interfaces/interface.data.row");
var interface_data_filter_1 = require("../interfaces/interface.data.filter");
var controller_data_parsers_1 = require("./parsers/controller.data.parsers");
var controller_data_search_modes_1 = require("./controller.data.search.modes");
var tools_guid_1 = require("./tools.guid");
var DATA_IS_UPDATE_1 = require("../interfaces/events/DATA_IS_UPDATE");
var FakeDataGenerator = (function () {
    function FakeDataGenerator() {
        this.rows = [];
        this.parts = [];
        this.count = 0;
        this.last = new Date(2017, 3, 4, 14, 59, 31, 738); //04-04 14:59:31.738
        /*
         04-04 08:00:09.981 +0200 I/[SC]KEEPALIVE(  465):      04-03 08:00:13.067: [ALIVE] clamp state changed (CLAMP_15 -> CLAMP_R)
        * */
    }
    FakeDataGenerator.prototype.getRandomNmb = function (lim) {
        if (lim === void 0) { lim = 100; }
        return Math.round(Math.random() * lim);
    };
    FakeDataGenerator.prototype.makeParts = function () {
        var res = '', src = 'QWERTYUIOPASDFGHJKLZXCVBNM1234567890';
        for (var i = 100; i >= 0; i -= 1) {
            res = '';
            for (var j = 16; j >= 0; j -= 1) {
                res += src[Math.floor(Math.random() * src.length)];
            }
            this.parts.push(res);
        }
    };
    FakeDataGenerator.prototype.getRandomStr = function (index) {
        if (index === void 0) { index = 0; }
        var res = '', row = new interface_data_row_1.DataRow();
        for (var i = 7; i >= 0; i -= 1) {
            row.str += this.parts[Math.floor(Math.random() * (this.parts.length - 1))];
            row.str += ' ... ';
        }
        return row;
    };
    FakeDataGenerator.prototype.getData = function () {
        this.makeParts();
        for (var i = this.count; i >= 0; i -= 1) {
            this.rows.push(this.getRandomStr(this.count - i + 1));
        }
        return this.rows;
    };
    FakeDataGenerator.prototype.getNextDataPackage = function () {
        var _this = this;
        function normalize(num, count) {
            if (count === void 0) { count = 2; }
            var res = '' + num;
            res = '0'.repeat(count - res.length) + res;
            return res;
        }
        var patterns = [
            ' +0200 I/[SC]KEEPALIVE(  465):      04-03 08:00:13.067: [ALIVE] clamp state changed (CLAMP_15 -> CLAMP_50)',
            ' +0200 I/[SC]KEEPALIVE(  465):      04-03 08:00:13.067: [ALIVE] clamp state changed (CLAMP_50 -> CLAMP_15)',
            ' +0200 I/[SC]KEEPALIVE(  465):      04-03 08:00:13.067: [ALIVE] clamp state changed (CLAMP_15 -> CLAMP_R)'
        ];
        return patterns.map(function (pattern) {
            var step = Math.round(Math.random() * 3000), next = new Date(_this.last.getTime() + step);
            _this.last = new Date(next.getTime());
            return normalize(next.getMonth() + 1, 2)
                + '-'
                + normalize(next.getDate(), 2)
                + ' '
                + normalize(next.getHours(), 2)
                + ':'
                + normalize(next.getMinutes(), 2)
                + ':'
                + normalize(next.getSeconds(), 2)
                + '.'
                + normalize(next.getMilliseconds(), 3) + ' ' + pattern;
        }).join('\r\n');
    };
    FakeDataGenerator.prototype.emulateRuntimeDate = function () {
        var data = this.getNextDataPackage();
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.STREAM_DATA_UPDATE, data);
        setTimeout(this.emulateRuntimeDate.bind(this), 1000);
    };
    return FakeDataGenerator;
}());
var DataController = (function () {
    function DataController() {
        this.callback = null;
        this.generator = null;
        this.dataFilter = new interface_data_filter_1.DataFilter();
        this.requests = {};
        this.data = {
            source: '',
            rows: [],
            indexes: {}
        };
        this.stream = {
            broken: ''
        };
        this.filters = {};
        this.regExpCache = {};
        this.indexesCache = {};
        this.generator = new FakeDataGenerator();
    }
    DataController.prototype.bindEvents = function () {
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_CHANGED, this.onSEARCH_REQUEST_CHANGED.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, this.onTXT_DATA_COME.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.STREAM_DATA_UPDATE, this.onSTREAM_DATA_UPDATE.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.REMEMBER_FILTER, this.onREMEMBER_FILTER.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.FORGET_FILTER, this.onFORGET_FILTER.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_RESET, this.onSEARCH_REQUEST_RESET.bind(this));
    };
    DataController.prototype.init = function (callback) {
        if (callback === void 0) { callback = null; }
        tools_logs_1.Logs.msg('[controller.data] Initialization.', tools_logs_1.TYPES.DEBUG);
        this.callback = typeof callback === 'function' ? callback : function () { };
        //this.generateFake();
        this.bindEvents();
        this.callback();
        tools_logs_1.Logs.msg('[controller.data] Finished.', tools_logs_1.TYPES.DEBUG);
    };
    DataController.prototype.generateFake = function () {
        //this.data.rows      = this.generator.getData();
        //this.data.source    = this.data.rows.join(';');
        this.generator.emulateRuntimeDate();
    };
    DataController.prototype.getRows = function () {
        return this.data.rows;
    };
    DataController.prototype.resetRegExpCache = function () {
        this.regExpCache = {};
        this.indexesCache = {};
    };
    DataController.prototype.getTextParser = function (mode) {
        function getIndex(index) {
            for (var i = index; i >= 0; i += 1) {
                if (this.data.indexes[i] !== void 0) {
                    return {
                        index: this.data.indexes[i],
                        start: i
                    };
                }
            }
            return {
                index: -1,
                start: -1
            };
        }
        ;
        switch (mode) {
            case controller_data_search_modes_1.MODES.TEXT:
                return function (str, smth) {
                    return ~str.indexOf(smth) ? true : false;
                }.bind(this);
            case controller_data_search_modes_1.MODES.REG:
                return function (str, smth, index) {
                    var reg = this.regExpCache[smth] !== void 0 ? this.regExpCache[smth] : null;
                    if (reg === null && smth !== '' || (reg !== null && reg.stamp !== this.data.rows.length) || (reg !== null && index >= this.data.rows.length)) {
                        try {
                            var _smth = smth.replace(/\\*$/gi, '')
                                .replace(/\\/gi, '\\');
                            reg = {
                                regExp: reg !== null ? reg.regExp : new RegExp(_smth, 'gi'),
                                indexes: reg !== null ? reg.indexes : {},
                                stamp: this.data.rows.length > index ? this.data.rows.length : (index + 1),
                                lastIndex: 0
                            };
                            reg.regExp.lastIndex = reg.lastIndex;
                            do {
                                var match = reg.regExp.exec(this.data.source);
                                var index_1 = null;
                                if (match !== null) {
                                    index_1 = match.index;
                                    index_1 = getIndex.call(this, index_1);
                                    if (index_1.index !== -1 && this.data.rows[index_1.index] !== void 0) {
                                        reg.indexes[index_1.index] = true;
                                        reg.lastIndex = reg.regExp.lastIndex;
                                        reg.regExp.lastIndex < index_1.start && (reg.regExp.lastIndex = index_1.start);
                                    }
                                }
                                else {
                                    break;
                                }
                            } while (true);
                            this.regExpCache[smth] = reg;
                        }
                        catch (error) {
                            this.regExpCache[smth] = {
                                indexes: null,
                            };
                        }
                    }
                    else if (reg === null && smth === '') {
                        this.regExpCache[smth] = {
                            indexes: null,
                        };
                    }
                    return reg.indexes === null ? true : (reg.indexes[index] !== void 0);
                }.bind(this);
            case controller_data_search_modes_1.MODES.PERIOD:
                return function (str, smth) {
                    return true;
                }.bind(this);
            default:
                return void 0;
        }
    };
    DataController.prototype.getMatchStr = function (mode) {
        var filter = this.dataFilter.value;
        if (typeof filter === 'string' && filter !== '') {
            switch (mode) {
                case controller_data_search_modes_1.MODES.TEXT:
                    return filter;
                case controller_data_search_modes_1.MODES.REG:
                    return filter.replace(/[^\d\w,\-\+\|@#$_=]/gi, '');
                case controller_data_search_modes_1.MODES.PERIOD:
                    return '';
                default:
                    return '';
            }
        }
        else {
            return '';
        }
    };
    DataController.prototype.filterData = function (rows, offset) {
        var _this = this;
        if (offset === void 0) { offset = 0; }
        var processor = this.getTextParser(this.dataFilter.mode), match = this.getMatchStr(this.dataFilter.mode), requestGUID = this.getRequestGUID(this.dataFilter.mode, this.dataFilter.value);
        var result = processor !== void 0 ? (rows.map(function (row, index) {
            row.filtered = _this.dataFilter.value === '' ? true : processor(row.str, _this.dataFilter.value, (index + offset));
            row.match = match;
            row.matchReg = _this.dataFilter.mode === controller_data_search_modes_1.MODES.REG;
            row.filters = {};
            row.requests[requestGUID] === void 0 && (row.requests[requestGUID] = row.filtered);
            Object.keys(_this.filters).forEach(function (GUID) {
                var filter = _this.filters[GUID];
                row.filters[GUID] = filter.value === '' ? true : filter.processor(row.str, filter.value, (index + offset));
            });
            return row;
        })) : null;
        return result !== null ? result : rows;
    };
    DataController.prototype.getRenderStr = function (str) {
        return str;
    };
    DataController.prototype.getRequestGUID = function (mode, value) {
        var key = mode + value;
        this.requests[key] === void 0 && (this.requests[key] = tools_guid_1.GUID.generate());
        return this.requests[key];
    };
    DataController.prototype.updateForFilter = function (filter, rows) {
        var _this = this;
        var processor = this.getTextParser(filter.mode), requestGUID = this.getRequestGUID(filter.mode, filter.value), measure = tools_logs_1.Logs.measure('[controller.data.ts][updateForFilter]: ' + filter.value), target = rows instanceof Array ? rows : this.data.rows;
        target = processor !== void 0 ? (target.map(function (row, index) {
            if (row.requests[requestGUID] === void 0) {
                var filtered = filter.value === '' ? true : processor(row.str, filter.value, index);
                //row.match       = match;
                row.filters = {};
                row.matchReg = filter.mode === controller_data_search_modes_1.MODES.REG;
                row.requests[requestGUID] === void 0 && (row.requests[requestGUID] = filtered);
                Object.keys(_this.filters).forEach(function (GUID) {
                    var filter = _this.filters[GUID];
                    row.filters[GUID] = filter.value === '' ? true : filter.processor(row.str, filter.value, index);
                });
                return row;
            }
            else {
                return row;
            }
        })) : target;
        tools_logs_1.Logs.measure(measure);
    };
    DataController.prototype.updateForParsers = function () {
        var measure = tools_logs_1.Logs.measure('[controller.data][updateForParsers]'), parsers = new controller_data_parsers_1.Parsers();
        this.data.rows = this.data.rows.map(function (row) {
            row.parsed = parsers.parse(row.str);
            return row;
        });
        /*
        * Can be optimized for using list of parser, which should be updated
        * */
        tools_logs_1.Logs.measure(measure);
    };
    DataController.prototype.onREMEMBER_FILTER = function (GUID) {
        this.filters[GUID] = {
            value: this.dataFilter.value,
            mode: this.dataFilter.mode,
            processor: this.getTextParser(this.dataFilter.mode)
        };
        this.data.rows = this.filterData(this.data.rows);
        //console.log('saved for ' + GUID);
    };
    DataController.prototype.onFORGET_FILTER = function (GUID) {
        delete this.filters[GUID];
        this.data.rows = this.filterData(this.data.rows);
        //console.log('removed for ' + GUID);
    };
    DataController.prototype.onSEARCH_REQUEST_CHANGED = function (dataFilter) {
        this.getRequestGUID(dataFilter.mode, dataFilter.value);
        this.dataFilter = new interface_data_filter_1.DataFilter(dataFilter.mode, dataFilter.value);
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_START, Object.assign({}, this.dataFilter));
        this.data.rows = this.filterData(this.data.rows);
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_FINISH, Object.assign({}, this.dataFilter));
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED, new DATA_IS_UPDATE_1.EVENT_DATA_IS_UPDATED(this.data.rows));
    };
    DataController.prototype.onTXT_DATA_COME = function (data, callback) {
        var _this = this;
        var measure = tools_logs_1.Logs.measure('[controller.data][onTXT_DATA_COME]'), rows = data.match(/[^\r\n]+/g), parsers = new controller_data_parsers_1.Parsers(), total = 0;
        rows = rows instanceof Array ? rows : [];
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_RESET);
        this.data.source = data;
        this.data.indexes = {};
        this.data.rows = rows.map(function (str, index) {
            total += str.length + 1;
            _this.data.indexes[total] = index;
            return {
                str: str,
                render_str: _this.getRenderStr(str),
                parsed: parsers.parse(str),
                filtered: true,
                match: '',
                matchReg: true,
                filters: {},
                requests: {}
            };
        });
        this.resetRegExpCache();
        tools_logs_1.Logs.measure(measure);
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED, new DATA_IS_UPDATE_1.EVENT_DATA_IS_UPDATED(this.data.rows));
        typeof callback === 'function' && callback();
    };
    DataController.prototype.onSTREAM_DATA_UPDATE = function (data) {
        var _this = this;
        if (this.data.rows instanceof Array) {
            var rows = null, _rows_1 = [], parsers_1 = new controller_data_parsers_1.Parsers(), offset = this.data.rows.length;
            //Check broken line from previous package
            this.stream.broken !== '' && (data = this.stream.broken + data);
            this.stream.broken = '';
            rows = data.match(/[^\r\n]+/g);
            if (rows instanceof Array && rows.length > 0) {
                //Check current package for broken line
                if (!~data.search(/.(\n|\n\r|\r|\r\n)$/gi)) {
                    rows[rows.length - 1] !== '' && (this.stream.broken = rows[rows.length - 1]);
                    rows[rows.length - 1] !== '' && tools_logs_1.Logs.msg('Broken line is found. Line excluded from current package and waiting for a next package.', tools_logs_1.TYPES.DEBUG);
                    rows.splice(rows.length - 1, 1);
                }
                if (rows.length > 0) {
                    if (this.stream.broken === '' && this.data.source !== '') {
                        this.data.source += '\n\r';
                    }
                    //Add data to source
                    this.data.source += data;
                    //We do not need to reset RegExp Cache
                    //Get parsed data
                    _rows_1 = this.filterData(rows.map(function (str) {
                        return {
                            str: str,
                            render_str: _this.getRenderStr(str),
                            parsed: parsers_1.parse(str),
                            filtered: true,
                            match: '',
                            matchReg: true,
                            filters: {},
                            requests: {}
                        };
                    }), offset);
                    //Get active requests and apply it
                    controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_GET_ALL, function (requests) {
                        requests instanceof Array && requests.forEach(function (request) {
                            if (request.type !== void 0 && request.value !== void 0) {
                                dataController.updateForFilter({
                                    mode: request.type,
                                    value: request.value
                                }, _rows_1);
                            }
                        });
                    });
                    //Add data to rows
                    (_a = this.data.rows).push.apply(_a, _rows_1);
                    //Call event of changing data
                    controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED, new DATA_IS_UPDATE_1.EVENT_DATA_IS_UPDATED(_rows_1));
                }
            }
        }
        var _a;
    };
    DataController.prototype.onSEARCH_REQUEST_RESET = function () {
        this.dataFilter = new interface_data_filter_1.DataFilter(controller_data_search_modes_1.MODES.REG, '');
    };
    return DataController;
}());
var dataController = new DataController();
exports.dataController = dataController;
//# sourceMappingURL=controller.data.new.js.map