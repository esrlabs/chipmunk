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
var common_1 = require("@angular/common");
var forms_1 = require("@angular/forms");
var component_1 = require("./input/component");
var component_2 = require("./drop-down-menu/component");
var component_3 = require("./popup/component");
var component_4 = require("./fileloader/component");
var component_5 = require("./progressbar.circle/component");
var component_6 = require("./progressbar.line/component");
var module_1 = require("./long-list/module");
var component_7 = require("./dialogs/dialog-a/component");
var component_8 = require("./dialogs/image/component");
var component_9 = require("./dialogs/dialog-message/component");
var component_10 = require("./dialogs/serial.settings/component");
var component_11 = require("./dialogs/views.list/component");
var component_12 = require("./dialogs/shortcuts.list/component");
var component_13 = require("./dialogs/api.settings/component");
var component_14 = require("./dialogs/colors/component");
var component_15 = require("./dialogs/colors.canvas/component");
var component_16 = require("./dialogs/markers.edit/component");
var component_17 = require("./dialogs/charts.edit.colors/component");
var component_18 = require("./dialogs/charts.edit.rules.hooks/component");
var component_19 = require("./dialogs/charts.edit.rules.segments/component");
var component_20 = require("./dialogs/charts.edit.type/component");
var component_21 = require("./dialogs/statemonitor.state.edit/component");
var component_22 = require("./dialogs/statemonitor.state.edit.icons/component");
var component_23 = require("./dialogs/statemonitor.indicate.edit/component");
var component_24 = require("./dialogs/serialports.list/component");
var component_25 = require("./dialogs/themes.list/component");
var component_26 = require("./dialogs/statemonitor.edit/component");
var component_27 = require("./buttons/flat-text/component");
var component_28 = require("./text/simple/component");
var component_29 = require("./lists/simple/component");
var component_30 = require("./lists/simple-drop-down/component");
var component_31 = require("./checkboxes/simple/component");
var component_32 = require("./other/connection.state/component");
var module_2 = require("./tabs/module");
var Components = (function () {
    function Components() {
    }
    return Components;
}());
Components = __decorate([
    core_1.NgModule({
        entryComponents: [component_3.Popup, component_4.FileLoader, component_5.ProgressBarCircle, component_25.DialogThemesList, component_24.DialogSerialPortsList, component_6.ProgressBarLine, component_9.DialogMessage, component_23.DialogStatemonitorIndicateEdit, component_22.StateMonitorStateEditIconsDialog, component_21.StateMonitorStateEditDialog, component_8.ImageDialog, component_7.DialogA, component_27.ButtonFlatText, component_28.SimpleText, component_29.SimpleList, component_30.SimpleDropDownList, component_10.DialogSerialSettings, component_31.SimpleCheckbox, component_11.ViewsList, component_12.ShortcutsList, component_13.DialogAPISettings, component_14.ColorsDialog, component_15.ColorsCanvasDialog, component_32.ConnectionState, component_20.ChartEditTypeDialog, component_19.ChartEditRulesSegmentsDialog, component_18.ChartEditRulesHooksDialog, component_17.ChartEditColorDialog, component_16.MarkersEditDialog, component_26.DialogStatemonitorEditJSON],
        imports: [common_1.CommonModule, forms_1.FormsModule],
        declarations: [component_1.CommonInput, component_2.DropDownMenu, component_3.Popup, component_4.FileLoader, component_25.DialogThemesList, component_24.DialogSerialPortsList, component_5.ProgressBarCircle, component_6.ProgressBarLine, component_9.DialogMessage, component_23.DialogStatemonitorIndicateEdit, component_22.StateMonitorStateEditIconsDialog, component_21.StateMonitorStateEditDialog, component_8.ImageDialog, component_7.DialogA, component_27.ButtonFlatText, component_28.SimpleText, component_29.SimpleList, component_30.SimpleDropDownList, component_10.DialogSerialSettings, component_31.SimpleCheckbox, component_11.ViewsList, component_12.ShortcutsList, component_13.DialogAPISettings, component_14.ColorsDialog, component_15.ColorsCanvasDialog, component_32.ConnectionState, component_20.ChartEditTypeDialog, component_19.ChartEditRulesSegmentsDialog, component_18.ChartEditRulesHooksDialog, component_17.ChartEditColorDialog, component_16.MarkersEditDialog, component_26.DialogStatemonitorEditJSON],
        exports: [component_1.CommonInput, component_2.DropDownMenu, module_1.LongListModule, module_2.CommonTabModule, component_3.Popup, component_4.FileLoader, component_25.DialogThemesList, component_24.DialogSerialPortsList, component_5.ProgressBarCircle, component_6.ProgressBarLine, component_9.DialogMessage, component_23.DialogStatemonitorIndicateEdit, component_22.StateMonitorStateEditIconsDialog, component_21.StateMonitorStateEditDialog, component_8.ImageDialog, component_7.DialogA, component_27.ButtonFlatText, component_28.SimpleText, component_29.SimpleList, component_30.SimpleDropDownList, component_10.DialogSerialSettings, component_31.SimpleCheckbox, component_11.ViewsList, component_12.ShortcutsList, component_13.DialogAPISettings, component_14.ColorsDialog, component_15.ColorsCanvasDialog, component_32.ConnectionState, component_20.ChartEditTypeDialog, component_19.ChartEditRulesSegmentsDialog, component_18.ChartEditRulesHooksDialog, component_17.ChartEditColorDialog, component_16.MarkersEditDialog, component_26.DialogStatemonitorEditJSON]
    }),
    __metadata("design:paramtypes", [])
], Components);
exports.Components = Components;
//# sourceMappingURL=components.js.map