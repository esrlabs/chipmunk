"use strict";
var controller_1 = require("../components/common/popup/controller");
var component_1 = require("../components/common/dialogs/views.list/component");
var AddView = (function () {
    function AddView() {
    }
    AddView.prototype.start = function () {
        this.showList();
    };
    AddView.prototype.showList = function () {
        var popupGUID = Symbol();
        controller_1.popupController.open({
            content: {
                factory: null,
                component: component_1.ViewsList,
                params: {
                    popupGUID: popupGUID
                }
            },
            title: _('Select New View'),
            settings: {
                move: true,
                resize: true,
                width: '30rem',
                height: '20rem',
                close: true,
                addCloseHandle: true,
                css: ''
            },
            buttons: [],
            titlebuttons: [],
            GUID: popupGUID
        });
    };
    return AddView;
}());
exports.AddView = AddView;
//# sourceMappingURL=handle.add.view.js.map