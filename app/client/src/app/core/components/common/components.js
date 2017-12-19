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
var component_7 = require("./progressbar.progress/component");
var module_1 = require("./long-list/module");
var component_8 = require("./dialogs/dialog-a/component");
var component_9 = require("./dialogs/image/component");
var component_10 = require("./dialogs/dialog-message/component");
var component_11 = require("./dialogs/serial.settings/component");
var component_12 = require("./dialogs/views.list/component");
var component_13 = require("./dialogs/shortcuts.list/component");
var component_14 = require("./dialogs/api.settings/component");
var component_15 = require("./dialogs/colors/component");
var component_16 = require("./dialogs/colors.canvas/component");
var component_17 = require("./dialogs/markers.edit/component");
var component_18 = require("./dialogs/charts.edit.colors/component");
var component_19 = require("./dialogs/charts.edit.rules.hooks/component");
var component_20 = require("./dialogs/charts.edit.rules.segments/component");
var component_21 = require("./dialogs/charts.edit.type/component");
var component_22 = require("./dialogs/statemonitor.state.edit/component");
var component_23 = require("./dialogs/statemonitor.state.edit.icons/component");
var component_24 = require("./dialogs/statemonitor.indicate.edit/component");
var component_25 = require("./dialogs/serialports.list/component");
var component_26 = require("./dialogs/themes.list/component");
var component_27 = require("./dialogs/update/component");
var component_28 = require("./dialogs/adblogcat.settings/component");
var component_29 = require("./dialogs/terminal.open/component");
var component_30 = require("./dialogs/statemonitor.edit/component");
var component_31 = require("./buttons/flat-text/component");
var component_32 = require("./text/simple/component");
var component_33 = require("./lists/simple/component");
var component_34 = require("./lists/simple-drop-down/component");
var component_35 = require("./checkboxes/simple/component");
var component_36 = require("./other/connection.state/component");
var module_2 = require("./tabs/module");
var Components = (function () {
    function Components() {
    }
    return Components;
}());
Components = __decorate([
    core_1.NgModule({
        entryComponents: [component_3.Popup, component_4.FileLoader, component_5.ProgressBarCircle, component_29.DialogTerminalStreamOpen, component_28.DialogADBLogcatStreamSettings, component_27.DialogUpdate, component_26.DialogThemesList, component_25.DialogSerialPortsList, component_6.ProgressBarLine, component_7.ProgressBarProgress, component_10.DialogMessage, component_24.DialogStatemonitorIndicateEdit, component_23.StateMonitorStateEditIconsDialog, component_22.StateMonitorStateEditDialog, component_9.ImageDialog, component_8.DialogA, component_31.ButtonFlatText, component_32.SimpleText, component_33.SimpleList, component_34.SimpleDropDownList, component_11.DialogSerialSettings, component_35.SimpleCheckbox, component_12.ViewsList, component_13.ShortcutsList, component_14.DialogAPISettings, component_15.ColorsDialog, component_16.ColorsCanvasDialog, component_36.ConnectionState, component_21.ChartEditTypeDialog, component_20.ChartEditRulesSegmentsDialog, component_19.ChartEditRulesHooksDialog, component_18.ChartEditColorDialog, component_17.MarkersEditDialog, component_30.DialogStatemonitorEditJSON],
        imports: [common_1.CommonModule, forms_1.FormsModule],
        declarations: [component_1.CommonInput, component_2.DropDownMenu, component_3.Popup, component_4.FileLoader, component_29.DialogTerminalStreamOpen, component_28.DialogADBLogcatStreamSettings, component_27.DialogUpdate, component_26.DialogThemesList, component_25.DialogSerialPortsList, component_5.ProgressBarCircle, component_6.ProgressBarLine, component_7.ProgressBarProgress, component_10.DialogMessage, component_24.DialogStatemonitorIndicateEdit, component_23.StateMonitorStateEditIconsDialog, component_22.StateMonitorStateEditDialog, component_9.ImageDialog, component_8.DialogA, component_31.ButtonFlatText, component_32.SimpleText, component_33.SimpleList, component_34.SimpleDropDownList, component_11.DialogSerialSettings, component_35.SimpleCheckbox, component_12.ViewsList, component_13.ShortcutsList, component_14.DialogAPISettings, component_15.ColorsDialog, component_16.ColorsCanvasDialog, component_36.ConnectionState, component_21.ChartEditTypeDialog, component_20.ChartEditRulesSegmentsDialog, component_19.ChartEditRulesHooksDialog, component_18.ChartEditColorDialog, component_17.MarkersEditDialog, component_30.DialogStatemonitorEditJSON],
        exports: [component_1.CommonInput, component_2.DropDownMenu, module_1.LongListModule, module_2.CommonTabModule, component_3.Popup, component_4.FileLoader, component_29.DialogTerminalStreamOpen, component_28.DialogADBLogcatStreamSettings, component_27.DialogUpdate, component_26.DialogThemesList, component_25.DialogSerialPortsList, component_5.ProgressBarCircle, component_6.ProgressBarLine, component_7.ProgressBarProgress, component_10.DialogMessage, component_24.DialogStatemonitorIndicateEdit, component_23.StateMonitorStateEditIconsDialog, component_22.StateMonitorStateEditDialog, component_9.ImageDialog, component_8.DialogA, component_31.ButtonFlatText, component_32.SimpleText, component_33.SimpleList, component_34.SimpleDropDownList, component_11.DialogSerialSettings, component_35.SimpleCheckbox, component_12.ViewsList, component_13.ShortcutsList, component_14.DialogAPISettings, component_15.ColorsDialog, component_16.ColorsCanvasDialog, component_36.ConnectionState, component_21.ChartEditTypeDialog, component_20.ChartEditRulesSegmentsDialog, component_19.ChartEditRulesHooksDialog, component_18.ChartEditColorDialog, component_17.MarkersEditDialog, component_30.DialogStatemonitorEditJSON]
    }),
    __metadata("design:paramtypes", [])
], Components);
exports.Components = Components;
//# sourceMappingURL=components.js.map