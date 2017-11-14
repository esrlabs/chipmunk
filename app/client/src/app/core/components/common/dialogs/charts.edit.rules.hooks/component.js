"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var core_1 = require("@angular/core");
var controller_data_parsers_tracker_manager_1 = require("../../../../modules/parsers/controller.data.parsers.tracker.manager");
var tools_guid_1 = require("../../../../modules/tools.guid");
var ChartEditRulesHooksDialog = (function () {
    function ChartEditRulesHooksDialog(changeDetectorRef) {
        this.changeDetectorRef = changeDetectorRef;
        this.callback = null;
        this.GUID = null;
        this.manager = new controller_data_parsers_tracker_manager_1.Manager();
        this.sets = {};
        this.data = null;
        this.tests = [];
        this.indexes = [];
        this.name = '';
        this.errors = [];
        this.changeDetectorRef = changeDetectorRef;
        this.onApply = this.onApply.bind(this);
        this.onNameChange = this.onNameChange.bind(this);
        this.onAddNewTest = this.onAddNewTest.bind(this);
        this.onRemoveTest = this.onRemoveTest.bind(this);
        this.onAddNewIndex = this.onAddNewIndex.bind(this);
        this.onRemoveIndex = this.onRemoveIndex.bind(this);
        this.onIndexHookChange = this.onIndexHookChange.bind(this);
        this.onIndexIndexChange = this.onIndexIndexChange.bind(this);
        this.onIndexLabelChange = this.onIndexLabelChange.bind(this);
        //Load available sets
        this.sets = this.manager.load();
        this.sets = this.sets !== null ? (typeof this.sets === 'object' ? this.sets : {}) : {};
    }
    ChartEditRulesHooksDialog.prototype.ngOnInit = function () {
        var _this = this;
        if (this.GUID !== null && this.sets[this.GUID] !== void 0) {
            this.data = Object.assign({}, this.sets[this.GUID]);
            this.tests = this.data.tests.map(function (value) {
                return {
                    GUID: tools_guid_1.GUID.generate(),
                    value: value
                };
            });
            this.indexes = Object.keys(this.data.indexes).map(function (key) {
                return {
                    GUID: tools_guid_1.GUID.generate(),
                    value: _this.data.indexes[key].value,
                    index: _this.data.indexes[key].index,
                    label: _this.data.indexes[key].label
                };
            });
            this.name = this.data.name;
        }
        else {
            this.data = {
                name: '',
                tests: [],
                lineColor: controller_data_parsers_tracker_manager_1.DEFAULTS.LINE_COLOR,
                textColor: controller_data_parsers_tracker_manager_1.DEFAULTS.TEXT_COLOR,
                active: true,
                indexes: null
            };
            this.tests = [];
            this.indexes = [];
            this.name = '';
        }
    };
    ChartEditRulesHooksDialog.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    ChartEditRulesHooksDialog.prototype.getErrorMessages = function () {
        var _this = this;
        if (this.name === '') {
            this.errors.push('Name of sets cannot be empty. Please define some name.');
        }
        if (this.tests.length > 0) {
            this.tests.forEach(function (test) {
                test.value.trim() === '' && _this.errors.push('You cannot define empty test RegExp. Please, remove empty one or define some RegExp for it.');
            });
        }
        else {
            this.errors.push('You should define at least one test RegExp. Without test-RegExp we cannot detect data in stream, which has necessary values for chart.');
        }
        if (this.indexes.length > 0) {
            var history_1 = {
                indexes: {},
                labels: {},
                values: {}
            };
            this.indexes.forEach(function (index) {
                if (index.value.trim() === '') {
                    _this.errors.push('You should define for index some value (hook). Define it or remove not valid index.');
                }
                if (index.label.trim() === '') {
                    _this.errors.push('You should define for index some label (will be shown on chart). Define it or remove not valid index.');
                }
                if (index.index < 0) {
                    _this.errors.push('Use as index number >= 0');
                }
                if (history_1.indexes[index.index] !== void 0) {
                    _this.errors.push('You have same value of index for several indexes. Check next index: ' + JSON.stringify(index));
                }
                history_1.indexes[index.index] = true;
                if (history_1.labels[index.label] !== void 0) {
                    _this.errors.push('You have same label for several indexes. Check next index: ' + JSON.stringify(index));
                }
                history_1.labels[index.label] = true;
                if (history_1.values[index.value] !== void 0) {
                    _this.errors.push('You have same value (hook) for several indexes. Check next index: ' + JSON.stringify(index));
                }
                history_1.values[index.value] = true;
            });
        }
        else {
            this.errors.push('You should define at least one index. Indexes - definition of data, which will be render on chart.');
        }
    };
    ChartEditRulesHooksDialog.prototype.save = function () {
        var _this = this;
        this.data.name = this.name;
        this.data.tests = this.tests.map(function (test) {
            return test.value;
        });
        this.data.indexes = {};
        this.indexes.forEach(function (index) {
            _this.data.indexes[index.value] = {
                value: index.value,
                index: index.index,
                label: index.label
            };
        });
        return Object.assign({}, this.data);
    };
    ChartEditRulesHooksDialog.prototype.onApply = function () {
        this.getErrorMessages();
        if (this.errors.length === 0) {
            typeof this.callback === 'function' && this.callback(this.save());
        }
        else {
        }
    };
    ChartEditRulesHooksDialog.prototype.onErrorsReset = function () {
        this.errors = [];
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Name
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    ChartEditRulesHooksDialog.prototype.onNameChange = function (event) {
        this.name = event.target['value'];
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Tests
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    ChartEditRulesHooksDialog.prototype.isEmptyAnyWhere = function () {
        var result = false;
        this.tests.forEach(function (test, i) {
            test['value'].trim() === '' && (result = true);
        });
        return result;
    };
    ChartEditRulesHooksDialog.prototype.getTestIndexByGUID = function (GUID) {
        var index = -1;
        this.tests.forEach(function (test, i) {
            test['GUID'] === GUID && (index = i);
        });
        return index;
    };
    ChartEditRulesHooksDialog.prototype.onAddNewTest = function () {
        if (!this.isEmptyAnyWhere()) {
            this.tests.push({
                GUID: tools_guid_1.GUID.generate(),
                value: ''
            });
        }
    };
    ChartEditRulesHooksDialog.prototype.onRemoveTest = function (GUID) {
        var index = this.getTestIndexByGUID(GUID);
        if (~index) {
            this.tests.splice(index, 1);
        }
    };
    ChartEditRulesHooksDialog.prototype.onTestChange = function (GUID, event) {
        var index = this.getTestIndexByGUID(GUID);
        ~index && (this.tests[index]['value'] = event.target['value']);
    };
    ChartEditRulesHooksDialog.prototype.onTestBlur = function (GUID, event) {
        if (this.tests.length > 1) {
            typeof event.target['value'] === 'string' && (event.target['value'].trim() === '' && this.onRemoveTest(GUID));
        }
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Indexes
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    ChartEditRulesHooksDialog.prototype.getIndexIndexByGUID = function (GUID) {
        var index = -1;
        this.indexes.forEach(function (test, i) {
            test['GUID'] === GUID && (index = i);
        });
        return index;
    };
    ChartEditRulesHooksDialog.prototype.onAddNewIndex = function () {
        this.indexes.push({
            GUID: tools_guid_1.GUID.generate(),
            value: '',
            index: 0,
            label: ''
        });
    };
    ChartEditRulesHooksDialog.prototype.onRemoveIndex = function (GUID) {
        var index = this.getIndexIndexByGUID(GUID);
        if (~index) {
            this.indexes.splice(index, 1);
        }
    };
    ChartEditRulesHooksDialog.prototype.onIndexHookChange = function (GUID, event) {
        var index = this.getIndexIndexByGUID(GUID);
        ~index && (this.indexes[index]['value'] = event.target['value']);
    };
    ChartEditRulesHooksDialog.prototype.onIndexIndexChange = function (GUID, event) {
        var index = this.getIndexIndexByGUID(GUID);
        ~index && (this.indexes[index]['index'] = event.target['value']);
    };
    ChartEditRulesHooksDialog.prototype.onIndexLabelChange = function (GUID, event) {
        var index = this.getIndexIndexByGUID(GUID);
        ~index && (this.indexes[index]['label'] = event.target['value']);
    };
    return ChartEditRulesHooksDialog;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], ChartEditRulesHooksDialog.prototype, "callback", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ChartEditRulesHooksDialog.prototype, "GUID", void 0);
ChartEditRulesHooksDialog = __decorate([
    core_1.Component({
        selector: 'chart-edit-rules-hooks-dialog',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], ChartEditRulesHooksDialog);
exports.ChartEditRulesHooksDialog = ChartEditRulesHooksDialog;
//# sourceMappingURL=component.js.map