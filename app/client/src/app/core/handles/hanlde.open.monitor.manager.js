"use strict";
var controller_1 = require("../components/common/popup/controller");
var component_1 = require("../components/common/progressbar.circle/component");
var component_2 = require("../components/common/text/simple/component");
var controller_events_1 = require("../modules/controller.events");
var controller_config_1 = require("../modules/controller.config");
var api_processor_1 = require("../api/api.processor");
var api_commands_1 = require("../api/api.commands");
var component_3 = require("../components/common/dialogs/monitor.manager/component");
var defaults_settings_1 = require("../components/common/dialogs/serial.settings/defaults.settings");
var DefaultMonitorSettings = (function () {
    function DefaultMonitorSettings() {
        this.maxFileSizeMB = 30;
        this.maxFilesCount = 30;
        this.port = '';
        this.portSettings = new defaults_settings_1.DefaultsPortSettings();
    }
    return DefaultMonitorSettings;
}());
var OpenMonitorManager = (function () {
    function OpenMonitorManager() {
        this.progressGUID = Symbol();
        this.processor = api_processor_1.APIProcessor;
        this.settings = null;
        this.button = {
            id: null,
            icon: 'fa-stethoscope',
            caption: 'Monitor Manager'
        };
        this.start = this.start.bind(this);
    }
    OpenMonitorManager.prototype.init = function () {
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.API_IS_READY_TO_USE, this.onAPI_IS_READY_TO_USE.bind(this));
    };
    OpenMonitorManager.prototype.onAPI_IS_READY_TO_USE = function () {
        var _this = this;
        this.getStateMonitor(function (state) {
            _this.updateState(state !== null ? state : { active: false, port: '' });
        });
    };
    OpenMonitorManager.prototype.getMonitorSettings = function (callback) {
        var _this = this;
        this.processor.send(api_commands_1.APICommands.getSettingsMonitor, {}, function (response) {
            if (typeof response === 'object' && response !== null && typeof response.output === 'object' && response.output !== null) {
                _this.onGetMonitorSettings(callback, response.output);
            }
            else {
                _this.onGetMonitorSettings(callback, null);
            }
        });
    };
    OpenMonitorManager.prototype.onGetMonitorSettings = function (callback, settings) {
        var _this = this;
        var validSettings = true;
        this.settings = settings;
        if (this.settings === null || typeof this.settings !== 'object') {
            validSettings = false;
        }
        else {
            var defaults_1 = new DefaultMonitorSettings();
            Object.keys(defaults_1).forEach(function (key) {
                if (_this.settings[key] === void 0 || typeof _this.settings[key] !== typeof defaults_1[key]) {
                    validSettings = false;
                }
            });
        }
        !validSettings && (this.settings = new DefaultMonitorSettings());
        typeof callback === 'function' && callback(Object.assign({}, settings));
    };
    OpenMonitorManager.prototype.updateState = function (state) {
        if (state.active) {
            this.button.id === null && this.addToolBarButton();
        }
        else {
            this.button.id !== null && this.removeToolBarButton();
        }
    };
    OpenMonitorManager.prototype.addToolBarButton = function () {
        this.button.id = Symbol();
        controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_TOOLBAR.ADD_BUTTON, [
            { id: this.button.id, icon: this.button.icon, caption: this.button.caption, handle: this.start, enable: true },
        ]);
    };
    OpenMonitorManager.prototype.removeToolBarButton = function () {
        controller_events_1.events.trigger(controller_config_1.configuration.sets.EVENTS_TOOLBAR.REMOVE_BUTTON, this.button.id);
        this.button.id = null;
    };
    OpenMonitorManager.prototype.getListPorts = function (callback) {
        this.processor.send(api_commands_1.APICommands.serialPortsList, {}, this.onListOfPorts.bind(this, callback));
    };
    OpenMonitorManager.prototype.onListOfPorts = function (callback, response, error) {
        if (error === null) {
            if (response.code === 0 && response.output instanceof Array) {
                typeof callback === 'function' && callback(response.output.map(function (port) {
                    return typeof port === 'object' ? (port !== null ? port.comName : null) : null;
                }).filter(function (port) {
                    return typeof port === 'string';
                }));
                return true;
            }
            else {
                this.showMessage(_('Error'), _('Server returned failed result. Code of error: ') + response.code + _('. Addition data: ') + response.output);
            }
        }
        else {
            this.showMessage(_('Error'), error.message);
        }
        typeof callback === 'function' && callback(null);
    };
    OpenMonitorManager.prototype.getFilesInfo = function (callback) {
        this.processor.send(api_commands_1.APICommands.getFilesDataMonitor, {}, this.onGetFilesInfo.bind(this, callback));
    };
    OpenMonitorManager.prototype.onGetFilesInfo = function (callback, response, error) {
        if (error === null) {
            if (response.code === 0 && typeof response.output === 'object' && response.output !== null && response.output.list !== void 0 && response.output.register !== void 0) {
                typeof callback === 'function' && callback(response.output);
                return true;
            }
            else {
                this.showMessage(_('Error'), _('Server returned failed result. Code of error: ') + response.code + _('. Addition data: ') + response.output);
            }
        }
        else {
            this.showMessage(_('Error'), error.message);
        }
        typeof callback === 'function' && callback(null);
    };
    OpenMonitorManager.prototype.getFileContent = function (file, callback) {
        this.processor.send(api_commands_1.APICommands.getFileContent, {
            file: file
        }, this.onGetFileContent.bind(this, callback));
    };
    OpenMonitorManager.prototype.getAllFilesContent = function (callback) {
        this.processor.send(api_commands_1.APICommands.getAllFilesContent, {}, this.onGetFileContent.bind(this, callback));
    };
    OpenMonitorManager.prototype.onGetFileContent = function (callback, response, error) {
        if (error === null) {
            if (response.code === 0 && typeof response.output === 'object' && response.output !== null && response.output.text !== void 0) {
                return typeof callback === 'function' && callback(response.output.text);
            }
        }
        else {
            this.showMessage(_('Error'), error.message);
        }
        typeof callback === 'function' && callback(null);
    };
    OpenMonitorManager.prototype.getMatches = function (reg, search, callback) {
        this.processor.send(api_commands_1.APICommands.getMatches, {
            reg: reg,
            search: search
        }, this.onGetMatches.bind(this, callback));
    };
    OpenMonitorManager.prototype.onGetMatches = function (callback, response, error) {
        if (error === null) {
            if (response.code === 0 && typeof response.output === 'object' && response.output !== null && response.output.result !== void 0
                && typeof response.output.result === 'object' && response.output.result !== null) {
                return typeof callback === 'function' && callback(response.output.result);
            }
        }
        else {
            this.showMessage(_('Error'), error.message);
        }
        typeof callback === 'function' && callback(null);
    };
    OpenMonitorManager.prototype.getStateMonitor = function (callback) {
        this.processor.send(api_commands_1.APICommands.getStateMonitor, {}, this.onGetStateMonitor.bind(this, callback));
    };
    OpenMonitorManager.prototype.onGetStateMonitor = function (callback, response, error) {
        if (error === null) {
            if (response.code === 0 && typeof response.output === 'object' && response.output !== null && typeof response.output.active === 'boolean' && typeof response.output.port === 'string') {
                this.updateState(response.output);
                return typeof callback === 'function' && callback(response.output);
            }
        }
        else {
            this.showMessage(_('Error'), error.message);
        }
        this.updateState({ active: false, port: '' });
        typeof callback === 'function' && callback(null);
    };
    OpenMonitorManager.prototype.stopAndClearMonitor = function (callback) {
        var _this = this;
        this.processor.send(api_commands_1.APICommands.stopAndClearMonitor, {}, function (response, error) {
            if (error === null) {
                if (response.code === 0) {
                    return typeof callback === 'function' && callback(true);
                }
            }
            else {
                _this.showMessage(_('Error'), error.message);
            }
            typeof callback === 'function' && callback(false);
        });
    };
    OpenMonitorManager.prototype.clearLogsOfMonitor = function (callback) {
        var _this = this;
        this.processor.send(api_commands_1.APICommands.clearLogsOfMonitor, {}, function (response, error) {
            if (error === null) {
                if (response.code === 0) {
                    return typeof callback === 'function' && callback(true);
                }
            }
            else {
                _this.showMessage(_('Error'), error.message);
            }
            typeof callback === 'function' && callback(false);
        });
    };
    OpenMonitorManager.prototype.setSettingsOfMonitor = function (callback, settings) {
        var _this = this;
        this.processor.send(api_commands_1.APICommands.setSettingsOfMonitor, {
            settings: settings
        }, function (response, error) {
            if (error === null) {
                if (response.code === 0) {
                    return typeof callback === 'function' && callback(true);
                }
            }
            else {
                _this.showMessage(_('Error'), error.message);
            }
            typeof callback === 'function' && callback(false);
        });
    };
    OpenMonitorManager.prototype.restartMonitor = function (callback) {
        var _this = this;
        this.processor.send(api_commands_1.APICommands.restartMonitor, {}, function (response, error) {
            if (error === null) {
                if (response.code === 0) {
                    return typeof callback === 'function' && callback(true);
                }
            }
            else {
                _this.showMessage(_('Error'), error.message);
            }
            typeof callback === 'function' && callback(false);
        });
    };
    OpenMonitorManager.prototype.start = function () {
        var _this = this;
        this.showProgress(_('Please wait... Getting list of available ports.'));
        this.getMonitorSettings(function (settings) {
            _this.getListPorts(function (ports) {
                ports = ports instanceof Array ? ports : [];
                _this.getFilesInfo(function (info) {
                    info = info !== null ? info : { list: [], register: {} };
                    _this.getStateMonitor(function (state) {
                        controller_1.popupController.close(_this.progressGUID);
                        state = state !== null ? state : { active: false, port: '' };
                        controller_1.popupController.open({
                            content: {
                                factory: null,
                                component: component_3.DialogMonitorManager,
                                params: Object.assign({
                                    ports: ports,
                                    files: info.list,
                                    register: info.register,
                                    state: state,
                                    getFileContent: _this.getFileContent.bind(_this),
                                    getAllFilesContent: _this.getAllFilesContent.bind(_this),
                                    getMatches: _this.getMatches.bind(_this),
                                    setSettingsOfMonitor: _this.setSettingsOfMonitor.bind(_this),
                                    stopAndClearMonitor: _this.stopAndClearMonitor.bind(_this),
                                    restartMonitor: _this.restartMonitor.bind(_this),
                                    clearLogsOfMonitor: _this.clearLogsOfMonitor.bind(_this),
                                    getStateMonitor: _this.getStateMonitor.bind(_this),
                                    getFilesInfo: _this.getFilesInfo.bind(_this)
                                }, _this.settings)
                            },
                            title: 'Monitor settings',
                            settings: {
                                move: true,
                                resize: true,
                                width: '40rem',
                                height: '45rem',
                                close: true,
                                addCloseHandle: true,
                                css: ''
                            },
                            buttons: [],
                            titlebuttons: [],
                            GUID: Symbol()
                        });
                    });
                });
            });
        });
    };
    OpenMonitorManager.prototype.showMessage = function (title, message) {
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_2.SimpleText,
                params: {
                    text: message
                }
            },
            title: title,
            settings: {
                move: true,
                resize: true,
                width: '20rem',
                height: '10rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: Symbol()
        });
    };
    OpenMonitorManager.prototype.showProgress = function (caption) {
        this.progressGUID = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_1.ProgressBarCircle,
                params: {}
            },
            title: caption,
            settings: {
                move: false,
                resize: false,
                width: '20rem',
                height: '10rem',
                close: false,
                addCloseHandle: false,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: this.progressGUID
        });
    };
    return OpenMonitorManager;
}());
var MonitorManager = new OpenMonitorManager();
exports.MonitorManager = MonitorManager;
//# sourceMappingURL=hanlde.open.monitor.manager.js.map