"use strict";
var DIRECTIONS = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE',
    OPTION: 'OPTION'
};
exports.DIRECTIONS = DIRECTIONS;
var CALLBACKS = {
    headers: 'headers',
    change: 'change',
    done: 'done',
    error: 'error',
    timeout: 'timeout',
    fail: 'fail'
};
exports.CALLBACKS = CALLBACKS;
var HEADERS = {
    CONTENT_TYPE: 'Content-Type',
    ACCEPT: 'Accept'
};
var Method = (function () {
    function Method(direction) {
        if (DIRECTIONS[direction] === void 0) {
            throw new Error('Use one of directions: [' + Object.keys(DIRECTIONS).join(', ') + '].');
        }
        else {
            this.direction = direction;
        }
    }
    Method.prototype.get = function () {
        return DIRECTIONS[this.direction];
    };
    return Method;
}());
exports.Method = Method;
var Request = (function () {
    function Request(_a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.url, url = _c === void 0 ? '' : _c, _d = _b.method, method = _d === void 0 ? new Method(DIRECTIONS.GET) : _d, _e = _b.callback, callback = _e === void 0 ? {} : _e, _f = _b.attempts, attempts = _f === void 0 ? 0 : _f, _g = _b.validator, validator = _g === void 0 ? {} : _g, _h = _b.headers, headers = _h === void 0 ? {} : _h, _j = _b.post, post = _j === void 0 ? {} : _j, _k = _b.parser, parser = _k === void 0 ? {} : _k;
        this.method = new Method(DIRECTIONS.GET);
        this.url = '';
        this.responseHeaders = {};
        this.callbacks = {};
        this.response = null;
        this.validator = null;
        this.parser = null;
        this.attempts = 0;
        this.requestHeaders = {};
        this.requestPost = {};
        this.requestPostParsed = '';
        if (typeof url === 'string' && url !== '') {
            if (method instanceof Method) {
                this.httpRequest = new XMLHttpRequest();
                this.url = url;
                this.method = method;
                this.callbacks = this.defaultCallbacks(callback);
                this.validator = this.defaultValidator(validator);
                this.parser = this.defaultParser(parser);
                this.attempts = attempts;
                this.requestHeaders = this.parseRequestHeaders(this.defaultRequestHeaders(headers));
                this.requestPost = post;
                this.requestPostParsed = this.parseRequestPost(post);
                this.httpRequest.onreadystatechange = this.onreadystatechange.bind(this);
                this.httpRequest.ontimeout = this.ontimeout.bind(this);
                this.httpRequest.onerror = this.onerror.bind(this);
                this.send();
            }
            else {
                throw new Error('Method should be defined as instance of class [Method]');
            }
        }
        else {
            throw new Error('URL should be defined as STRING.');
        }
    }
    Request.prototype.send = function () {
        this.httpRequest.open(this.method.get(), this.url, true);
        this.setRequestHeaders();
        this.httpRequest.send(this.requestPostParsed);
    };
    Request.prototype.nextAttempt = function () {
        if (this.attempts > 1) {
            this.attempts -= 1;
            this.send();
            return true;
        }
        else {
            return false;
        }
    };
    Request.prototype.ontimeout = function (event) {
        this.acceptTimeout(event);
    };
    Request.prototype.onerror = function (event) {
        this.acceptError(event);
    };
    Request.prototype.onreadystatechange = function (event) {
        switch (this.httpRequest.readyState) {
            case XMLHttpRequest.HEADERS_RECEIVED:
                this.acceptHeaders();
                break;
            case XMLHttpRequest.DONE:
                if (this.httpRequest.status === 200) {
                    this.acceptSuccess();
                }
                else {
                    this.acceptError(event);
                    return false;
                }
                break;
        }
    };
    Request.prototype.callback = function (name) {
        var _this = this;
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        if (name instanceof Array) {
            name.forEach(function (name) {
                _this.callbacks[name].forEach(function (callback) {
                    callback.apply(_this, args);
                });
            });
        }
        else {
            this.callbacks[name].forEach(function (callback) {
                callback.apply(_this, args);
            });
        }
    };
    Request.prototype.acceptHeaders = function () {
        var _this = this;
        var headers = this.httpRequest.getAllResponseHeaders();
        if (typeof headers === 'string') {
            headers.split('\r\n').forEach(function (header) {
                var pair = header.split(':');
                if (pair.length === 2) {
                    _this.responseHeaders[pair[0]] = pair[1];
                }
            });
        }
        this.callback(CALLBACKS.headers, this.responseHeaders);
    };
    Request.prototype.acceptSuccess = function () {
        this.response = this.httpRequest.responseText;
        try {
            this.response = JSON.parse(this.response);
        }
        catch (e) { }
        this.response = this.parser(this.response);
        if (this.validator(this.response)) {
            this.callback(CALLBACKS.done, this.response);
        }
        else {
            this.acceptError(new Error('Not valid responce'));
        }
    };
    Request.prototype.acceptError = function (event) {
        !this.nextAttempt() && this.callback([CALLBACKS.error, CALLBACKS.fail], event);
    };
    Request.prototype.acceptChange = function (event) {
        this.callback(CALLBACKS.change, event);
    };
    Request.prototype.acceptTimeout = function (event) {
        !this.nextAttempt() && this.callback([CALLBACKS.timeout, CALLBACKS.fail], event);
    };
    Request.prototype.defaultValidator = function (validator) {
        return typeof validator === 'function' ? validator : function () { return true; };
    };
    Request.prototype.defaultParser = function (parser) {
        return typeof parser === 'function' ? parser : function (data) { return data; };
    };
    Request.prototype.defaultCallbacks = function (callbacks) {
        if (callbacks === void 0) { callbacks = {}; }
        if (typeof callbacks === 'function') {
            callbacks = (_a = {},
                _a[CALLBACKS.done] = [callbacks],
                _a);
        }
        else if (typeof callbacks !== 'object' || callbacks === null) {
            callbacks = {};
        }
        Object.keys(CALLBACKS).forEach(function (key) {
            callbacks[CALLBACKS[key]] === void 0 && (callbacks[CALLBACKS[key]] = []);
            !(callbacks[CALLBACKS[key]] instanceof Array) && (callbacks[CALLBACKS[key]] = [callbacks[CALLBACKS[key]]]);
        });
        return callbacks;
        var _a;
    };
    Request.prototype.defaultRequestHeaders = function (headers) {
        if (headers === void 0) { headers = null; }
        if (typeof headers !== 'object' || headers === null) {
            headers = {};
        }
        headers[HEADERS.CONTENT_TYPE] === void 0 && (headers[HEADERS.CONTENT_TYPE] = 'application/x-www-form-urlencoded');
        headers[HEADERS.ACCEPT] === void 0 && (headers[HEADERS.ACCEPT] = '*/*');
        return headers;
    };
    Request.prototype.parseRequestHeaders = function (headers) {
        if (headers === void 0) { headers = {}; }
        Object.keys(headers).forEach(function (key) {
            var parts = key.split('-');
            parts.forEach(function (part, index) {
                parts[index] = part.charAt(0).toUpperCase() + part.slice(1);
            });
            headers[parts.join('-')] = headers[key];
        });
        return headers;
    };
    Request.prototype.setRequestHeaders = function () {
        var _this = this;
        Object.keys(this.requestHeaders).forEach(function (key) {
            if (typeof _this.requestHeaders[key] === 'string') {
                _this.httpRequest.setRequestHeader(key, _this.requestHeaders[key]);
            }
            else {
                throw new Error('Value of header should be STRING. Check HEADER [' + key + ']');
            }
        });
    };
    Request.prototype.parseRequestPost = function (post) {
        if (post === void 0) { post = {}; }
        var params = {}, result = '';
        if (post instanceof Array) {
            post.map(function (param) {
                if (typeof param === 'string') {
                    return param.trim();
                }
                else {
                    throw new Error('As parameter (in array) can be used only STRING');
                }
            }).forEach(function (param) {
                var pair = param.split('=');
                if (pair.length === 2) {
                    params[pair[0]] = pair[1];
                }
                else {
                    throw new Error('As parameter (in array) can be used only pair: key=value');
                }
            });
        }
        else if (typeof post === 'object' && post !== null) {
            Object.keys(post).forEach(function (key) {
                switch (typeof post[key]) {
                    case 'string':
                        params[key] = post[key];
                        break;
                    case 'boolean':
                        params[key] = post[key].toString();
                        break;
                    case 'number':
                        params[key] = post[key].toString();
                        break;
                    default:
                        try {
                            params[key] = JSON.stringify(post[key]);
                        }
                        catch (e) { }
                        break;
                }
            });
        }
        else if (typeof post !== 'string') {
            throw new Error('Parameters of request can be: OBJECT[key = value], ARRAY[key,value] or STRING. Type of not valid parameters is: [' + typeof post + ']');
        }
        else {
            params = post;
        }
        if (typeof params === 'object') {
            if (/application\/json/gi.test(this.requestHeaders[HEADERS.CONTENT_TYPE])) {
                result = JSON.stringify(params);
            }
            else {
                var encodeURI_1 = /-urlencoded/gi.test(this.requestHeaders[HEADERS.CONTENT_TYPE]);
                Object.keys(params).forEach(function (key, index) {
                    result += (index > 0 ? '&' : '') + key + '=' + (encodeURI_1 ? encodeURIComponent(params[key]) : params[key]);
                });
            }
        }
        //Parameters are converted to string
        return result;
    };
    Request.prototype.then = function (callback) {
        if (callback === void 0) { callback = null; }
        typeof callback === 'function' && this.callbacks[CALLBACKS.done].push(callback);
        return this;
    };
    Request.prototype.catch = function (callback) {
        if (callback === void 0) { callback = null; }
        typeof callback === 'function' && this.callbacks[CALLBACKS.fail].push(callback);
        return this;
    };
    return Request;
}());
exports.Request = Request;
//# sourceMappingURL=tools.ajax.js.map