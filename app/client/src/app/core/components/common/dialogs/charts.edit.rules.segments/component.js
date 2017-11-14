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
var ChartEditRulesSegmentsDialog = (function () {
    function ChartEditRulesSegmentsDialog(changeDetectorRef) {
        this.changeDetectorRef = changeDetectorRef;
        this.callback = null;
        this.GUID = null;
        this.manager = new controller_data_parsers_tracker_manager_1.Manager();
        this.sets = {};
        this.data = null;
        this.segments = [];
        this.values = [];
        this.clearing = [];
        this.indexes = [];
        this.name = '';
        this.errors = [];
        this.changeDetectorRef = changeDetectorRef;
        this.onNameChange = this.onNameChange.bind(this);
        this.onApply = this.onApply.bind(this);
        this.onAddNew = this.onAddNew.bind(this);
        this.onRemove = this.onRemove.bind(this);
        this.onAddNewIndex = this.onAddNewIndex.bind(this);
        this.onRemoveIndex = this.onRemoveIndex.bind(this);
        this.onIndexHookChange = this.onIndexHookChange.bind(this);
        this.onIndexIndexChange = this.onIndexIndexChange.bind(this);
        this.onIndexLabelChange = this.onIndexLabelChange.bind(this);
        //Load available sets
        this.sets = this.manager.load();
        this.sets = this.sets !== null ? (typeof this.sets === 'object' ? this.sets : {}) : {};
    }
    ChartEditRulesSegmentsDialog.prototype.ngOnInit = function () {
        var _this = this;
        if (this.GUID !== null && this.sets[this.GUID] !== void 0) {
            this.data = this.sets[this.GUID];
            ['segments', 'values', 'clearing'].forEach(function (target) {
                _this[target] = _this.data[target].map(function (value) {
                    return {
                        GUID: tools_guid_1.GUID.generate(),
                        value: value
                    };
                });
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
                segments: [],
                values: [],
                clearing: [],
                lineColor: controller_data_parsers_tracker_manager_1.DEFAULTS.LINE_COLOR,
                textColor: controller_data_parsers_tracker_manager_1.DEFAULTS.TEXT_COLOR,
                active: true,
                indexes: null
            };
            ['segments', 'values', 'clearing'].forEach(function (target) {
                _this[target] = [];
            });
            this.indexes = [];
            this.name = '';
        }
    };
    ChartEditRulesSegmentsDialog.prototype.forceUpdate = function () {
        this.changeDetectorRef.detectChanges();
    };
    ChartEditRulesSegmentsDialog.prototype.getErrorMessages = function () {
        var _this = this;
        if (this.name === '') {
            this.errors.push('Name of sets cannot be empty. Please define some name.');
        }
        ['segments', 'values', 'clearing'].forEach(function (target) {
            if (_this[target].length > 0) {
                _this[target].forEach(function (smth) {
                    smth.value.trim() === '' && _this.errors.push('You cannot define empty ' + target + ' RegExp.');
                });
            }
            else {
                _this.errors.push('You should define at least one ' + target + ' RegExp.');
            }
        });
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
    ChartEditRulesSegmentsDialog.prototype.save = function () {
        var _this = this;
        this.data.name = this.name;
        ['segments', 'values', 'clearing'].forEach(function (target) {
            _this.data[target] = _this[target].map(function (smth) {
                return smth.value;
            });
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
    ChartEditRulesSegmentsDialog.prototype.onApply = function () {
        this.getErrorMessages();
        if (this.errors.length === 0) {
            typeof this.callback === 'function' && this.callback(this.save());
        }
        else {
        }
    };
    ChartEditRulesSegmentsDialog.prototype.onErrorsReset = function () {
        this.errors = [];
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Name
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    ChartEditRulesSegmentsDialog.prototype.onNameChange = function (event) {
        this.name = event.target['value'];
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Common
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    ChartEditRulesSegmentsDialog.prototype.isEmptyAnyWhere = function (target) {
        var result = false;
        this[target].forEach(function (item, i) {
            item['value'].trim() === '' && (result = true);
        });
        return result;
    };
    ChartEditRulesSegmentsDialog.prototype.getIndexByGUID = function (target, GUID) {
        var index = -1;
        this[target].forEach(function (item, i) {
            item['GUID'] === GUID && (index = i);
        });
        return index;
    };
    ChartEditRulesSegmentsDialog.prototype.onAddNew = function (target) {
        if (!this.isEmptyAnyWhere(target)) {
            this[target].push({
                GUID: tools_guid_1.GUID.generate(),
                value: ''
            });
        }
    };
    ChartEditRulesSegmentsDialog.prototype.onRemove = function (target, GUID) {
        var index = this.getIndexByGUID(target, GUID);
        if (~index) {
            this[target].splice(index, 1);
        }
    };
    ChartEditRulesSegmentsDialog.prototype.onChange = function (target, GUID, event) {
        var index = this.getIndexByGUID(target, GUID);
        ~index && (this[target][index]['value'] = event.target['value']);
    };
    ChartEditRulesSegmentsDialog.prototype.onBlur = function (target, GUID, event) {
        if (this[target].length > 1) {
            typeof event.target['value'] === 'string' && (event.target['value'].trim() === '' && this.onRemove(target, GUID));
        }
    };
    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    * Indexes
    * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    ChartEditRulesSegmentsDialog.prototype.getIndexIndexByGUID = function (GUID) {
        var index = -1;
        this.indexes.forEach(function (test, i) {
            test['GUID'] === GUID && (index = i);
        });
        return index;
    };
    ChartEditRulesSegmentsDialog.prototype.onAddNewIndex = function () {
        this.indexes.push({
            GUID: tools_guid_1.GUID.generate(),
            value: '',
            index: 0,
            label: ''
        });
    };
    ChartEditRulesSegmentsDialog.prototype.onRemoveIndex = function (GUID) {
        var index = this.getIndexIndexByGUID(GUID);
        if (~index) {
            this.indexes.splice(index, 1);
        }
    };
    ChartEditRulesSegmentsDialog.prototype.onIndexHookChange = function (GUID, event) {
        var index = this.getIndexIndexByGUID(GUID);
        ~index && (this.indexes[index]['value'] = event.target['value']);
    };
    ChartEditRulesSegmentsDialog.prototype.onIndexIndexChange = function (GUID, event) {
        var index = this.getIndexIndexByGUID(GUID);
        ~index && (this.indexes[index]['index'] = event.target['value']);
    };
    ChartEditRulesSegmentsDialog.prototype.onIndexLabelChange = function (GUID, event) {
        var index = this.getIndexIndexByGUID(GUID);
        ~index && (this.indexes[index]['label'] = event.target['value']);
    };
    return ChartEditRulesSegmentsDialog;
}());
__decorate([
    core_1.Input(),
    __metadata("design:type", Function)
], ChartEditRulesSegmentsDialog.prototype, "callback", void 0);
__decorate([
    core_1.Input(),
    __metadata("design:type", String)
], ChartEditRulesSegmentsDialog.prototype, "GUID", void 0);
ChartEditRulesSegmentsDialog = __decorate([
    core_1.Component({
        selector: 'chart-edit-rules-segments-dialog',
        templateUrl: './template.html',
    }),
    __metadata("design:paramtypes", [core_1.ChangeDetectorRef])
], ChartEditRulesSegmentsDialog);
exports.ChartEditRulesSegmentsDialog = ChartEditRulesSegmentsDialog;
//# sourceMappingURL=component.js.map