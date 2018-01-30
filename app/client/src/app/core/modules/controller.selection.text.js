"use strict";
var controller_clipboard_shortcuts_1 = require("./controller.clipboard.shortcuts");
var EVENTS = {
    mousedown: 'mousedown',
    mouseup: 'mouseup'
};
var TextSelection = (function () {
    function TextSelection(target, trigger) {
        this.inProgress = false;
        this.trigger = null;
        this.target = null;
        this.clipboardShortcuts = new controller_clipboard_shortcuts_1.ClipboardShortcuts();
        if (target) {
            if (target.addEventListener !== void 0) {
                this[EVENTS.mousedown] = this[EVENTS.mousedown].bind(this);
                this[EVENTS.mouseup] = this[EVENTS.mouseup].bind(this);
                this.windowMouseUpListener = this.windowMouseUpListener.bind(this);
                target.addEventListener(EVENTS.mousedown, this[EVENTS.mousedown]);
                target.addEventListener(EVENTS.mouseup, this[EVENTS.mouseup]);
                this.trigger = trigger;
                this.target = target;
                this.clipboardShortcuts.onCopy.subscribe(this.onCopy.bind(this));
                this.clipboardShortcuts.onPaste.subscribe(this.onPaste.bind(this));
            }
        }
    }
    TextSelection.prototype.destroy = function () {
        this.clipboardShortcuts.onCopy.unsubscribe();
        this.clipboardShortcuts.onPaste.unsubscribe();
        this.clipboardShortcuts.destroy();
        this.target.removeEventListener(EVENTS.mousedown, this[EVENTS.mousedown]);
        this.target.removeEventListener(EVENTS.mouseup, this[EVENTS.mouseup]);
        this.unbindWindowListener();
    };
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
    TextSelection.prototype.onCopy = function (event) {
        var text = typeof event.selection.toString === 'function' ? event.selection.toString() : null;
        var reg = /\u0001/gi;
        if (text === null) {
            return false;
        }
        if (!~text.search(/\u0001/gi)) {
            return false;
        }
        var element = document.createElement('P');
        element.style.opacity = '0.0001';
        element.style.position = 'absolute';
        element.style.width = '1px';
        element.style.height = '1px';
        element.style.overflow = 'hidden';
        element.innerHTML = text.replace(/\u0001\d*\u0001/gi, '').replace(/[\n\r]/gi, '</br>');
        document.body.appendChild(element);
        var range = document.createRange();
        range.selectNode(element);
        event.selection.empty();
        event.selection.addRange(range);
        this.clipboardShortcuts.doCopy();
        event.selection.empty();
        document.body.removeChild(element);
    };
    TextSelection.prototype.onPaste = function () {
    };
    TextSelection.prototype[EVENTS.mousedown] = function (event) {
        this.bindWindowListener();
        this.inProgress = true;
    };
    TextSelection.prototype[EVENTS.mouseup] = function (event) {
        var selection = window.getSelection();
        if (typeof selection.toString === 'function') {
            this.trigger.emit(selection.toString());
        }
    };
    return TextSelection;
}());
exports.TextSelection = TextSelection;
//# sourceMappingURL=controller.selection.text.js.map