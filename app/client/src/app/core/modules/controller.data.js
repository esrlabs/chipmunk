"use strict";
var tools_logs_1 = require("./tools.logs");
var controller_events_1 = require("./controller.events");
var controller_config_1 = require("./controller.config");
var interface_data_filter_1 = require("../interfaces/interface.data.filter");
var controller_data_search_modes_1 = require("./controller.data.search.modes");
var DATA_IS_UPDATE_1 = require("../interfaces/events/DATA_IS_UPDATE");
var data_processor_interfaces_1 = require("../../workers/data.processor.interfaces");
var RegSrcMarks = {
    BEGIN: '\u001D',
    END: '\u001E',
    NUMBER: '\\\u001D\\d+\\\u001E',
    SELECTOR: /\u001D(\d*)\u001E/gi
};
var DataController = (function () {
    function DataController() {
        this.dataFilter = new interface_data_filter_1.DataFilter();
        this.requests = {};
        this.data = {
            source: '',
            rows: [],
            srcRegs: ''
        };
        this.stream = {
            broken: ''
        };
        this.filters = {};
        this.regExpCache = {};
        this.indexesCache = {};
        this.worker = new Worker('./app/workers/data.processor.loader.js');
        this.workerJobs = 0;
    }
    DataController.prototype.bindEvents = function () {
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_CHANGED, this.onSEARCH_REQUEST_CHANGED.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, this.onTXT_DATA_COME.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.STREAM_DATA_UPDATE, this.onSTREAM_DATA_UPDATE.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.REMEMBER_FILTER, this.onREMEMBER_FILTER.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.FORGET_FILTER, this.onFORGET_FILTER.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_RESET, this.onSEARCH_REQUEST_RESET.bind(this));
        controller_events_1.events.bind(controller_config_1.configuration.sets.SYSTEM_EVENTS.VIEW_OUTPUT_IS_CLEARED, this.onVIEW_OUTPUT_IS_CLEARED.bind(this));
        this.worker.addEventListener('message', this.onWorkerMessage.bind(this));
    };
    DataController.prototype.onWorkerMessage = function (event) {
        var response = event.data;
        (response.rows !== void 0) && (this.data.rows = response.rows);
        switch (response.event) {
            case controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED:
                controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED, new DATA_IS_UPDATE_1.EVENT_DATA_IS_UPDATED(response.rows));
                break;
            case controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED:
                controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED, new DATA_IS_UPDATE_1.EVENT_DATA_IS_UPDATED(response.processedRows));
                break;
            case controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_START:
                controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_START, response.filter);
                break;
            case controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_FINISH:
                controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_FINISH, response.filter);
                break;
            case controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED:
                controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED, new DATA_IS_UPDATE_1.EVENT_DATA_IS_UPDATED(response.rows));
                break;
            case controller_config_1.configuration.sets.SYSTEM_EVENTS.FILTER_IS_APPLIED:
                controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.FILTER_IS_APPLIED, response.rows);
                break;
        }
        this.workerJobs -= 1;
        if (response.command === 'ready') {
            this.workerJobs = 0;
        }
        this.workerJobs === 0 && controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.GLOBAL_PROGRESS_HIDE);
    };
    DataController.prototype.sendWorkerMessage = function (message) {
        this.workerJobs === 0 && controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.GLOBAL_PROGRESS_SHOW);
        this.workerJobs += 1;
        this.worker.postMessage(message);
    };
    DataController.prototype.init = function (callback) {
        if (callback === void 0) { callback = null; }
        tools_logs_1.Logs.msg('[controller.data] Initialization.', tools_logs_1.TYPES.DEBUG);
        this.bindEvents();
        typeof callback === 'function' && callback();
        tools_logs_1.Logs.msg('[controller.data] Finished.', tools_logs_1.TYPES.DEBUG);
    };
    DataController.prototype.getRows = function () {
        return this.data.rows;
    };
    DataController.prototype.getRequestGUID = function (mode, value) {
        var key = mode + value;
        //this.requests[key] === void 0 && (this.requests[key] = GUID.generate());
        this.requests[key] === void 0 && (this.requests[key] = key);
        return this.requests[key];
    };
    DataController.prototype.updateForParsers = function () {
        this.sendWorkerMessage({
            command: data_processor_interfaces_1.WorkerCommands.updateParsers,
            configuration: this.getConfigurationForWorker()
        });
    };
    DataController.prototype.updateForFilter = function (filter) {
        this.sendWorkerMessage({
            command: data_processor_interfaces_1.WorkerCommands.addRequest,
            filter: filter,
            event: controller_config_1.configuration.sets.SYSTEM_EVENTS.FILTER_IS_APPLIED,
            configuration: this.getConfigurationForWorker()
        });
    };
    DataController.prototype.onREMEMBER_FILTER = function () {
        this.sendWorkerMessage({
            command: data_processor_interfaces_1.WorkerCommands.addFilter,
            value: this.dataFilter.value,
            mode: this.dataFilter.mode,
            configuration: this.getConfigurationForWorker()
        });
    };
    DataController.prototype.onFORGET_FILTER = function (GUID) {
        this.sendWorkerMessage({
            command: data_processor_interfaces_1.WorkerCommands.removeFilter,
            GUID: GUID,
            configuration: this.getConfigurationForWorker()
        });
    };
    DataController.prototype.onSEARCH_REQUEST_CHANGED = function (dataFilter) {
        this.sendWorkerMessage({
            command: data_processor_interfaces_1.WorkerCommands.updateActiveFilter,
            event: controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            eventAfter: controller_config_1.configuration.sets.SYSTEM_EVENTS.SEARCH_REQUEST_PROCESS_FINISH,
            filter: dataFilter,
            configuration: this.getConfigurationForWorker()
        });
    };
    DataController.prototype.onTXT_DATA_COME = function (data) {
        this.sendWorkerMessage({
            command: data_processor_interfaces_1.WorkerCommands.create,
            str: data,
            event: controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            configuration: this.getConfigurationForWorker()
        });
    };
    DataController.prototype.onSTREAM_DATA_UPDATE = function (data) {
        var _this = this;
        controller_events_1.events.trigger(controller_config_1.configuration.sets.SYSTEM_EVENTS.REQUESTS_HISTORY_GET_ALL, function (requests) {
            _this.sendWorkerMessage({
                command: data_processor_interfaces_1.WorkerCommands.add,
                str: data,
                requests: requests instanceof Array ? requests.map(function (request) {
                    return {
                        mode: request.type,
                        value: request.value
                    };
                }) : [],
                event: controller_config_1.configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED,
                configuration: _this.getConfigurationForWorker()
            });
        });
    };
    DataController.prototype.onSEARCH_REQUEST_RESET = function () {
        this.dataFilter = new interface_data_filter_1.DataFilter(controller_data_search_modes_1.MODES.REG, '');
    };
    DataController.prototype.onVIEW_OUTPUT_IS_CLEARED = function () {
        this.onTXT_DATA_COME('');
    };
    DataController.prototype.getConfigurationForWorker = function () {
        return {
            sets: controller_config_1.configuration.sets
        };
    };
    return DataController;
}());
var dataController = new DataController();
exports.dataController = dataController;
//# sourceMappingURL=controller.data.js.map