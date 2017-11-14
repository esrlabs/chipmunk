/*
* @description Controller of loading all components of application
*
* Logic of work:
* In section #1 developer define reference to module, which should be loaded and initialized.
* Module should me implementation of interface (interfaces/interface.module.initiable/InitiableModule).
* It means, module should have method init(callback:Function).
*
* In section #2-3 developer define name of tasks and references between tasks and modules.
*
* In section #4 developer define ordering of loading and initialization of modules
* */
"use strict";
/*
* @description Section #1: references to modules, which should be loaded and initialized
* */
var controller_config_1 = require("./modules/controller.config");
var tools_localization_1 = require("./modules/tools.localization");
var tools_logs_1 = require("./modules/tools.logs");
var controller_events_1 = require("./modules/controller.events");
var controller_data_1 = require("./modules/controller.data");
/*
* @description Section #2: name (aliases) of tasks
* */
var TASKS = {
    LOGS: Symbol(),
    LOCALE: Symbol(),
    CONFIG: Symbol(),
    EVENTS: Symbol(),
    DATA: Symbol()
};
/*
* @description Section #3: references between tasks and modules
* */
var RUNNERS = (_a = {},
    _a[TASKS.LOGS] = tools_logs_1.Logs,
    _a[TASKS.LOCALE] = tools_localization_1.locale,
    _a[TASKS.CONFIG] = controller_config_1.configuration,
    _a[TASKS.EVENTS] = controller_events_1.events,
    _a[TASKS.DATA] = controller_data_1.dataController,
    _a);
/*
* @description Section #4: ordering of processing of tasks
* */
var ORDERING = [
    [TASKS.LOGS],
    [TASKS.CONFIG, TASKS.LOCALE],
    [TASKS.EVENTS],
    [TASKS.DATA]
];
/*
* @description Class, which implement loading of modules. */
var Loader = (function () {
    function Loader() {
        this.queue = [];
        this.callback = null;
    }
    Loader.prototype.getPromise = function (module) {
        return new Promise(function (resolve, reject) {
            module['init'](function () {
                resolve();
            });
        });
    };
    Loader.prototype.getQueue = function () {
        var _this = this;
        var tasks = this.queue.shift();
        return tasks.map(function (task) {
            return _this.getPromise(RUNNERS[task]);
        });
    };
    Loader.prototype.nextInQueue = function () {
        var _this = this;
        Promise.all(this.getQueue()).then(function () {
            if (_this.queue.length > 0) {
                _this.nextInQueue();
            }
            else {
                _this.callback();
            }
        }).catch(function (error) {
            var message = 'no error details';
            if (typeof error === 'object' && error !== null && typeof error.message === 'string') {
                message = error.message;
            }
            throw new Error('Cannot normally finish loading of application [core.load]. Error: ' + message);
        });
    };
    Loader.prototype.init = function (callback) {
        if (callback === void 0) { callback = null; }
        (_a = this.queue).push.apply(_a, ORDERING);
        this.callback = callback;
        this.nextInQueue();
        var _a;
    };
    return Loader;
}());
var loader = new Loader();
exports.loader = loader;
var _a;
//# sourceMappingURL=core.load.js.map