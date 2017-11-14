"use strict";
var EVENTS = {
    mousedown: 'mousedown',
    mouseup: 'mouseup'
};
var TextSelection = (function () {
    function TextSelection(target, trigger) {
        this.inProgress = false;
        this.trigger = null;
        if (target) {
            if (target.addEventListener !== void 0) {
                this[EVENTS.mousedown] = this[EVENTS.mousedown].bind(this);
                this[EVENTS.mouseup] = this[EVENTS.mouseup].bind(this);
                this.windowMouseUpListener = this.windowMouseUpListener.bind(this);
                target.addEventListener(EVENTS.mousedown, this[EVENTS.mousedown]);
                target.addEventListener(EVENTS.mouseup, this[EVENTS.mouseup]);
                this.trigger = trigger;
            }
        }
    }
    TextSelection.prototype.bindWindowListener = function () {
        window.addEventListener(EVENTS.mouseup, this.windowMouseUpListener);
    };
    TextSelection.prototype.unbindWindowListener = function () {
        window.removeEventListener(EVENTS.mouseup, this.windowMouseUpListener);
    };
    TextSelection.prototype.windowMouseUpListener = function (event) {
        this.unbindWindowListener();
        this.inProgress = false;
    };
    TextSelection.prototype[EVENTS.mousedown] = function (event) {
        this.bindWindowListener();
        this.inProgress = true;
    };
    TextSelection.prototype[EVENTS.mouseup] = function (event) {
        var selection = window.getSelection(), text = '';
        if (typeof selection.toString === 'function') {
            this.trigger.emit(selection.toString());
        }
    };
    return TextSelection;
}());
exports.TextSelection = TextSelection;
//# sourceMappingURL=controller.selection.text.js.map