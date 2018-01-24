"use strict";
var tools_logs_js_1 = require("../core/modules/tools.logs.js");
var controller_data_parsers_js_1 = require("../core/modules/parsers/controller.data.parsers.js");
var controller_data_search_modes_js_1 = require("../core/modules/controller.data.search.modes.js");
var data_processor_interfaces_js_1 = require("../workers/data.processor.interfaces.js");
var Helpers = (function () {
    function Helpers() {
    }
    Helpers.getRequestGUID = function (mode, value) {
        return mode + value;
    };
    return Helpers;
}());
var Processors = (function () {
    function Processors() {
        this._cache = {};
        this[controller_data_search_modes_js_1.MODES.TEXT] = this[controller_data_search_modes_js_1.MODES.TEXT].bind(this);
        this[controller_data_search_modes_js_1.MODES.REG] = this[controller_data_search_modes_js_1.MODES.REG].bind(this);
    }
    Processors.prototype.getIndexByPosition = function (fragmentLength, indexes, position) {
        for (var i = position; i <= fragmentLength; i += 1) {
            if (indexes[i] !== void 0) {
                return {
                    index: indexes[i],
                    start: i
                };
            }
        }
        return {
            index: -1,
            start: -1
        };
    };
    Processors.prototype.getRegExpMap = function (fragment, smth, indexes) {
        var map = [];
        try {
            var regExp = new RegExp(smth.replace(/\\*$/gi, '').replace(/\\/gi, '\\'), 'gi');
            var match = null;
            var index = null;
            var fragmentLength = fragment.length;
            do {
                match = regExp.exec(fragment);
                index = null;
                if (match !== null) {
                    index = match.index;
                    index = this.getIndexByPosition(fragmentLength, indexes, index);
                    if (index.index !== -1) {
                        map.push(index.index);
                        regExp.lastIndex < index.start && (regExp.lastIndex = index.start);
                    }
                }
                else {
                    break;
                }
            } while (true);
        }
        catch (error) {
            map = null;
        }
        return map;
    };
    Processors.prototype[controller_data_search_modes_js_1.MODES.TEXT] = function (str, smth, position, indexes, fragment) {
        return ~str.indexOf(smth) ? true : false;
    };
    Processors.prototype[controller_data_search_modes_js_1.MODES.REG] = function (str, smth, position, indexes, fragment) {
        var cached = this._cache[smth] !== void 0 ? this._cache[smth] : null;
        if (cached === null && smth !== '') {
            this._cache[smth] = this.getRegExpMap(fragment, smth, indexes);
        }
        else if (cached === null && smth === '') {
            this._cache[smth] = null;
        }
        return this._cache[smth] === null ? true : (this._cache[smth].indexOf(position) !== -1);
    };
    Processors.prototype.getMatchString = function (value, mode) {
        var filter = value;
        if (typeof filter === 'string' && filter !== '') {
            switch (mode) {
                case controller_data_search_modes_js_1.MODES.TEXT:
                    return filter;
                case controller_data_search_modes_js_1.MODES.REG:
                    return filter.replace(/[^\d\w,\-\+\|@#$_=]/gi, '');
                case controller_data_search_modes_js_1.MODES.PERIOD:
                    return '';
                default:
                    return '';
            }
        }
        else {
            return '';
        }
    };
    Processors.prototype.get = function (mode) {
        if (this[mode] === void 0) {
            return null;
        }
        return this[mode];
    };
    Processors.prototype.getCache = function () {
        return this._cache;
    };
    Processors.prototype.setCache = function (cache) {
        this._cache = cache;
    };
    return Processors;
}());
var FragmentReader = (function () {
    function FragmentReader() {
    }
    FragmentReader.prototype.request = function (request, rows, indexes, fragment, filters) {
        var processors = new Processors();
        var processor = processors.get(request.mode);
        var requestGUID = Helpers.getRequestGUID(request.mode, request.value);
        if (requestGUID === '') {
            return rows;
        }
        var measure = tools_logs_js_1.Logs.measure('[data.processor][Fragment][request]: ' + request.value);
        var result = rows.map(function (row, position) {
            row.requests[requestGUID] = (processor !== null ? processor(row.str, request.value, position, indexes, fragment) : true);
            return row;
        });
        tools_logs_js_1.Logs.measure(measure);
        return result !== null ? result : rows;
    };
    FragmentReader.prototype.filter = function (filter, rows, indexes, fragment, filters, requests) {
        var _this = this;
        var processors = new Processors();
        var processor = processors.get(filter.mode);
        var match = processors.getMatchString(filter.value, filter.mode);
        var filterGUID = Helpers.getRequestGUID(filter.mode, filter.value);
        var measure = tools_logs_js_1.Logs.measure('[data.processor][Fragment][filter]: ' + filter.value);
        var result = rows.map(function (row, position) {
            //str : string, smth : string, position: number, indexes: Object, fragment: string
            if (row.requests === void 0) {
                row.requests = {};
            }
            if (filterGUID !== '' && filter.value !== '') {
                if (row.requests[filterGUID] === void 0) {
                    row.filtered = processor !== null ? processor(row.str, filter.value, position, indexes, fragment) : true;
                    row.requests[filterGUID] = row.filtered;
                }
                else {
                    row.filtered = row.requests[filterGUID];
                }
            }
            else {
                row.filtered = true;
            }
            row.match = match;
            row.matchReg = filter.mode === controller_data_search_modes_js_1.MODES.REG;
            row.filters = {};
            requests.forEach(function (request) {
                var GUID = Helpers.getRequestGUID(request.mode, request.value);
                if (row.requests[GUID] === void 0) {
                    var processor_1 = processors.get(request.mode);
                    row.requests[GUID] = request.value === '' ? true : (processor_1 !== null ? processor_1(row.str, request.value, position, indexes, fragment) : true);
                }
            });
            Object.keys(filters).forEach(function (GUID) {
                var filter = _this.filters[GUID];
                var processor = processors.get(filter.mode);
                row.filters[GUID] = filter.value === '' ? true : (processor !== null ? processor(row.str, filter.value, position, indexes, fragment) : true);
            });
            return row;
        });
        tools_logs_js_1.Logs.measure(measure);
        return result !== null ? result : rows;
    };
    FragmentReader.prototype.filters = function (rows, activeRequests, indexes, fragment, filters) {
        if (!(activeRequests instanceof Array)) {
            return rows;
        }
        if (!(rows instanceof Array)) {
            return rows;
        }
        /*
        activeRequests.forEach((request: any)=>{
            this.filter(request, rows, indexes, fragment, filters, []);
        });
        */
        return rows;
    };
    FragmentReader.prototype.getRows = function (fragment, filter, filters, requests) {
        var parsers = new controller_data_parsers_js_1.Parsers();
        var result = {
            rows: [],
            indexes: {},
            rest: '',
            fragment: ''
        };
        var rows = typeof fragment === 'string' ? fragment.match(/[^\r\n]+/g) : null;
        if (!(rows instanceof Array) || rows.length === 0) {
            return result;
        }
        //Check current package for broken line
        if (!~fragment.search(/.(\n|\n\r|\r|\r\n)$/gi)) {
            rows[rows.length - 1] !== '' && (result.rest = rows[rows.length - 1]);
            rows[rows.length - 1] !== '' && tools_logs_js_1.Logs.msg('Broken line is found. Line excluded from current package and waiting for a next package.', tools_logs_js_1.TYPES.DEBUG);
            rows.splice(rows.length - 1, 1);
        }
        if (rows.length === 0) {
            return result;
        }
        //Build indexes
        var totalLength = 0;
        rows.forEach(function (str, index) {
            totalLength += str.length;
            result.indexes[totalLength] = index;
        });
        //Remove breaks: we don't need it anymore, because we have indexes
        result.fragment = fragment.replace(/[\r\n]/gi, '');
        //Get rows
        result.rows = this.filter(filter, rows.map(function (str) {
            return {
                str: str,
                parsed: parsers.parse(str),
                filtered: true,
                match: '',
                matchReg: true,
                filters: {},
                requests: {}
            };
        }), result.indexes, result.fragment, filters, requests);
        return result;
    };
    return FragmentReader;
}());
var Stream = (function () {
    function Stream() {
        this._source = '';
        this._rows = [];
        this._indexes = {};
        this._rest = '';
        this._filters = {};
        this._activeFilter = { mode: '', value: '' };
        this._requests = {};
    }
    Stream.prototype._reset = function () {
        this._rows = [];
        this._indexes = {};
        this._source = '';
        this._rest = '';
    };
    Stream.prototype._create = function (fragment, activeRequests) {
        var measure = tools_logs_js_1.Logs.measure('[data.processor][Stream][create]');
        var reader = new FragmentReader();
        var result = reader.getRows(fragment, this._activeFilter, this._filters, activeRequests);
        this._rows = result.rows;
        this._indexes = result.indexes;
        this._source = result.fragment;
        tools_logs_js_1.Logs.measure(measure);
        return this._rows;
    };
    Stream.prototype._add = function (fragment, activeRequests) {
        var _this = this;
        var measure = tools_logs_js_1.Logs.measure('[data.processor][Stream][add]');
        var reader = new FragmentReader();
        var result = reader.getRows(this._rest + fragment, this._activeFilter, this._filters, activeRequests);
        var offsetRows = this._rows.length;
        var offsetLength = this._source.length;
        //Add rows
        (_a = this._rows).push.apply(_a, result.rows);
        //Add indexes
        Object.keys(result.indexes).forEach(function (key) {
            _this._indexes[parseInt(key) + offsetLength] = result.indexes[key] + offsetRows;
        });
        //Update rest
        this._rest = result.rest;
        //Update source
        this._source += result.fragment;
        tools_logs_js_1.Logs.measure(measure);
        return result.rows;
        var _a;
    };
    Stream.prototype._updateFilters = function () {
        var measure = tools_logs_js_1.Logs.measure('[data.processor][Stream][applyFilter]');
        var reader = new FragmentReader();
        this._rows = reader.filter(null, this._rows, this._indexes, this._source, this._filters, []);
        tools_logs_js_1.Logs.measure(measure);
        return true;
    };
    Stream.prototype._updateActiveFilter = function (filter) {
        var measure = tools_logs_js_1.Logs.measure('[data.processor][Stream][updateActiveFilter]');
        var reader = new FragmentReader();
        this._activeFilter = filter;
        this._rows = reader.filter(filter, this._rows, this._indexes, this._source, this._filters, []);
        tools_logs_js_1.Logs.measure(measure);
        return true;
    };
    Stream.prototype._addRequest = function (request) {
        var _this = this;
        var reader = new FragmentReader();
        var GUID = Helpers.getRequestGUID(request.mode, request.value);
        if (request.value !== '' /*&& this._requests[GUID] === void 0*/) {
            var measure = tools_logs_js_1.Logs.measure('[data.processor][Stream][addRequest]');
            this._requests[GUID] = request;
            this._rows = reader.filter(this._activeFilter, this._rows, this._indexes, this._source, this._filters, Object.keys(this._requests).map(function (GUID) {
                return _this._requests[GUID];
            }));
            tools_logs_js_1.Logs.measure(measure);
        }
        return true;
    };
    Stream.prototype._updateParsers = function () {
        var measure = tools_logs_js_1.Logs.measure('[data.processor][updateParsers]');
        var parsers = new controller_data_parsers_js_1.Parsers();
        this._rows = this._rows.map(function (row) {
            row.parsed = parsers.parse(row.str);
            return row;
        });
        tools_logs_js_1.Logs.measure(measure);
        /*
        * Can be optimized for using list of parser, which should be updated
        * */
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Promises wrappers
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    Stream.prototype.create = function (fragment, activeRequests) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            resolve(_this._create(fragment, activeRequests));
        });
    };
    Stream.prototype.add = function (fragment, activeRequests) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            resolve(_this._add(fragment, activeRequests));
        });
    };
    Stream.prototype.addFilter = function (mode, value) {
        if (this._filters[Helpers.getRequestGUID(mode, value)] !== void 0) {
            return false;
        }
        this._filters[Helpers.getRequestGUID(mode, value)] = {
            mode: mode,
            value: value
        };
        return true;
    };
    Stream.prototype.removeFilter = function (ID) {
        if (this._filters[ID] === void 0) {
            return false;
        }
        delete this._filters[ID];
        return true;
    };
    Stream.prototype.updateFilters = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var result = _this._updateFilters();
            result && resolve(_this._rows);
            !result && reject();
        });
    };
    Stream.prototype.updateActiveFilter = function (filter) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this._updateActiveFilter(filter);
            resolve(_this._rows);
        });
    };
    Stream.prototype.addRequest = function (request) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this._addRequest(request);
            resolve(_this._rows);
        });
    };
    Stream.prototype.updateParsers = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this._updateParsers();
            resolve(_this._rows);
        });
    };
    return Stream;
}());
var stream = new Stream();
var Configuration = {};
onmessage = function (event) {
    var _this = this;
    var request = event.data;
    if (typeof request !== 'object' || request === null) {
        return false;
    }
    request.event = request.event === void 0 ? null : request.event;
    request.eventBefore = request.eventBefore === void 0 ? null : request.eventBefore;
    request.eventAfter = request.eventAfter === void 0 ? null : request.eventAfter;
    if (request.configuration !== void 0) {
        //Worker doesn't have access to window object and doesn't have access to localStorage as result.
        //So, we provides settings via parameters of event and as glo al object
        Configuration = request.configuration;
    }
    request.eventBefore !== null && postMessage.call(this, {
        event: request.eventBefore
    });
    switch (request.command) {
        case data_processor_interfaces_js_1.WorkerCommands.create:
            stream.create(request.str, [])
                .then(function (rows) {
                request.eventAfter !== null && postMessage.call(_this, {
                    event: request.eventAfter
                });
                postMessage.call(_this, {
                    event: request.event,
                    rows: rows
                });
            });
            break;
        case data_processor_interfaces_js_1.WorkerCommands.add:
            stream.add(request.str, request.requests)
                .then(function (rows) {
                request.eventAfter !== null && postMessage.call(_this, {
                    event: request.eventAfter
                });
                postMessage.call(_this, {
                    event: request.event,
                    processedRows: rows
                });
            });
            break;
        case data_processor_interfaces_js_1.WorkerCommands.addFilter:
            if (stream.addFilter(request.value, request.mode)) {
                stream.updateFilters().then(function (rows) {
                    request.eventAfter !== null && postMessage.call(_this, {
                        event: request.eventAfter
                    });
                    postMessage.call(_this, {
                        event: request.event,
                        rows: rows
                    });
                });
            }
            else {
            }
            break;
        case data_processor_interfaces_js_1.WorkerCommands.addRequest:
            stream.addRequest(request.filter).then(function (rows) {
                request.eventAfter !== null && postMessage.call(_this, {
                    event: request.eventAfter
                });
                postMessage.call(_this, {
                    event: request.event,
                    rows: rows
                });
            });
            break;
        case data_processor_interfaces_js_1.WorkerCommands.removeFilter:
            if (stream.removeFilter(request.GUID)) {
                stream.updateFilters().then(function (rows) {
                    request.eventAfter !== null && postMessage.call(_this, {
                        event: request.eventAfter
                    });
                    postMessage.call(_this, {
                        event: request.event,
                        rows: rows
                    });
                });
            }
            else {
            }
            break;
        case data_processor_interfaces_js_1.WorkerCommands.updateActiveFilter:
            stream.updateActiveFilter(request.filter)
                .then(function (rows) {
                request.eventAfter !== null && postMessage.call(_this, {
                    event: request.eventAfter
                });
                postMessage.call(_this, {
                    event: request.event,
                    rows: rows
                });
            });
            break;
        case data_processor_interfaces_js_1.WorkerCommands.updateParsers:
            stream.updateParsers()
                .then(function (rows) {
                request.eventAfter !== null && postMessage.call(_this, {
                    event: request.eventAfter
                });
                postMessage.call(_this, {
                    event: request.event,
                    rows: rows
                });
            });
            break;
    }
};
//# sourceMappingURL=data.processor.js.map