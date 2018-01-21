"use strict";
var tools_logs_js_1 = require("./tools.logs.js");
var GUID = Symbol('__eventsControllerGUIDSymbol');
var Event = (function () {
    function Event(id) {
        if (id === void 0) { id = ''; }
        this.id = '';
        this.handles = {};
        this.id = id;
        this.handles = {};
    }
    Event.prototype.attach = function (handle) {
        var symbol = Symbol();
        this.handles[symbol] = handle;
        handle[GUID] = symbol;
        return handle[GUID];
    };
    Event.prototype.detach = function (smth) {
        if (typeof smth === 'function' && smth[GUID] !== void 0) {
            delete this.handles[smth[GUID]];
        }
        else if (typeof smth === 'symbol') {
            delete this.handles[smth[GUID]];
        }
    };
    Event.prototype.handle = function () {
        var _this = this;
        var agrs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            agrs[_i] = arguments[_i];
        }
        Promise.all(Object.getOwnPropertySymbols(this.handles).map(function (GUID) {
            return new Promise(function (resolve, reject) {
                try {
                    (_a = _this.handles)[GUID].apply(_a, agrs);
                    resolve();
                }
                catch (e) {
                    console.log(e.message);
                    reject(e);
                }
                var _a;
            });
        })).catch(function (e) {
            throw e;
        });
    };
    Event.prototype.isEmpty = function () {
        return Object.getOwnPropertySymbols(this.handles).length === 0;
    };
    return Event;
}());
var Events = (function () {
    function Events() {
        this.storage = new Map();
    }
    Events.prototype.init = function (callback) {
        tools_logs_js_1.Logs.msg('[controller.events][OK]:: ready.', tools_logs_js_1.TYPES.LOADING);
        callback();
    };
    Events.prototype.add = function (id) {
        if (id === void 0) { id = ''; }
        if (typeof id === 'string' && id.trim() === '') {
            tools_logs_js_1.Logs.msg('[controller.events][TypeError]:: Event name (id) cannot be empty string.', tools_logs_js_1.TYPES.ERROR);
        }
        else if (typeof id === 'string' || typeof id === 'symbol') {
            !this.storage.has(id) && this.storage.set(id, (new Event(id)));
            return this.storage.get(id);
        }
        else {
            tools_logs_js_1.Logs.msg('[controller.events][TypeError]:: Event name (id) can be a STRING or SYMBOL.', tools_logs_js_1.TYPES.ERROR);
        }
    };
    Events.prototype.bind = function (id, handle) {
        if (id === void 0) { id = ''; }
        if (handle === void 0) { handle = null; }
        var holder = this.add(id);
        return holder.attach(handle);
    };
    Events.prototype.unbind = function (id, smth) {
        if (id === void 0) { id = ''; }
        if (this.storage.has(id)) {
            var holder = this.storage.get(id);
            holder.detach(smth);
            holder.isEmpty() && this.storage.delete(id);
        }
    };
    Events.prototype.trigger = function (id) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var holder = this.storage.get(id);
        holder && holder.handle.apply(holder, args);
        holder && tools_logs_js_1.Logs.msg('[controller.events][Triggering]:: ' + id, tools_logs_js_1.TYPES.EVENT_TRACKING);
    };
    return Events;
}());
var EventsController = (function () {
    function EventsController() {
        this.GUIDs = [];
    }
    EventsController.prototype.bind = function (event, handle) {
        this.GUIDs.push({
            event: event,
            GUID: events.bind(event, handle)
        });
    };
    EventsController.prototype.trigger = function (id) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        events.trigger.apply(events, [id].concat(args));
    };
    EventsController.prototype.kill = function () {
        this.GUIDs.forEach(function (event) {
            events.unbind(event.event, event.GUID);
        });
    };
    return EventsController;
}());
exports.EventsController = EventsController;
var events = new Events();
exports.events = events;
//# sourceMappingURL=controller.events.js.map