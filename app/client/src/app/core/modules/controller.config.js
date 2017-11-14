"use strict";
var tools_ajax_1 = require("./tools.ajax");
var tools_objects_validator_1 = require("./tools.objects.validator");
var tools_logs_1 = require("./tools.logs");
var interface_configuration_sets_1 = require("../interfaces/interface.configuration.sets");
var ALIASES = {
    SETS: 'SETS',
    ORDERING: 'ORDERING'
};
var SETTINGS = {
    PATH: 'app/config/',
    REGISTER: 'register.json',
    VALIDATOR: (_a = {}, _a[ALIASES.SETS] = Object.prototype, _a[ALIASES.ORDERING] = Array.prototype, _a)
};
var ConfigurationController = (function () {
    function ConfigurationController() {
        this.register = {};
        this.queue = [];
        this.callback = null;
        this.sets = new interface_configuration_sets_1.ConfigurationSets();
    }
    ConfigurationController.prototype.init = function (callback) {
        var _this = this;
        if (callback === void 0) { callback = null; }
        tools_logs_1.Logs.msg('[controller.config] Start loading configuration.', tools_logs_1.TYPES.LOADING);
        (new tools_ajax_1.Request({
            url: SETTINGS.PATH + SETTINGS.REGISTER,
            method: new tools_ajax_1.Method(tools_ajax_1.DIRECTIONS.GET),
            validator: this.validator
        })).then(function (response) {
            var validation = tools_objects_validator_1.validator.validate(response, SETTINGS.VALIDATOR);
            if (!(validation instanceof Error)) {
                _this.register = response;
                (_a = _this.queue).push.apply(_a, _this.register[ALIASES.ORDERING]);
                tools_logs_1.Logs.msg('[controller.config][OK]:: ' + SETTINGS.REGISTER, tools_logs_1.TYPES.LOADING);
                _this.load();
            }
            else {
                throw new Error('Structure of [register] is not valid: ' + validation.message);
            }
            var _a;
        }).catch(function (error) {
            var message = 'no error details';
            if (typeof error === 'object' && error !== null && typeof error.message === 'string') {
                message = error.message;
            }
            throw new Error('Can not load register of configuration. Error: ' + message);
        });
        this.callback = typeof callback === 'function' ? callback : function () { };
    };
    ConfigurationController.prototype.parser = function (response) {
        if (typeof response === 'object' && response !== null) {
            return response;
        }
        else {
            //Try remove comments
            response = response.replace(/\/\*[^]*?\*\//gmi, '').replace(/\/\/.*/gi, '');
            //Try manually parse
            try {
                response = JSON.parse(response);
                return response;
            }
            catch (e) { }
            return null;
        }
    };
    ConfigurationController.prototype.validator = function (response) {
        if (typeof response === 'object' && response !== null) {
            return true;
        }
        else {
            return false;
        }
    };
    ConfigurationController.prototype.getPromise = function (source) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var request = new tools_ajax_1.Request({
                url: SETTINGS.PATH + _this.register[ALIASES.SETS][source],
                method: new tools_ajax_1.Method(tools_ajax_1.DIRECTIONS.GET),
                validator: _this.validator,
                parser: _this.parser
            }).then(function (response) {
                _this.sets[source] = response;
                tools_logs_1.Logs.msg('[controller.config][OK]:: ' + source, tools_logs_1.TYPES.LOADING);
                resolve();
            }).catch(function (error) {
                var message = 'no error details';
                if (typeof error === 'object' && error !== null && typeof error.message === 'string') {
                    message = error.message;
                }
                reject();
                throw new Error('Can not load source [' + source + '] of configuration. Error: ' + message);
            });
        });
    };
    ConfigurationController.prototype.getQueue = function () {
        var _this = this;
        var sources = this.queue.shift();
        typeof sources === 'string' && (sources = [sources]);
        if (sources instanceof Array) {
            return sources.map(function (source) {
                if (_this.register[ALIASES.SETS][source] !== void 0) {
                    return _this.getPromise(source);
                }
                else {
                    throw new Error('Preset [' + source + '] does not have definition in section [' + ALIASES.SETS + ']. Check [register.json].');
                }
            });
        }
        else {
            throw new Error('Definition of ordering in [' + SETTINGS.REGISTER + '] has wrong format. Expect: STRING or STRING[].');
        }
    };
    ConfigurationController.prototype.freeze = function () {
        this.sets = Object.freeze(Object.assign({}, this.sets));
    };
    ConfigurationController.prototype.nextInQueue = function () {
        var _this = this;
        Promise.all(this.getQueue()).then(function () {
            if (_this.queue.length > 0) {
                _this.nextInQueue();
            }
            else {
                tools_logs_1.Logs.msg('[controller.config] Finish loading configuration.', tools_logs_1.TYPES.LOADING);
                _this.freeze();
                _this.callback();
            }
        }).catch(function (error) {
            var message = 'no error details';
            if (typeof error === 'object' && error !== null && typeof error.message === 'string') {
                message = error.message;
            }
            throw new Error('Can not load some source of configuration. Error: ' + message);
        });
    };
    ConfigurationController.prototype.load = function () {
        this.nextInQueue();
    };
    return ConfigurationController;
}());
var configuration = new ConfigurationController();
exports.configuration = configuration;
var _a;
//# sourceMappingURL=controller.config.js.map