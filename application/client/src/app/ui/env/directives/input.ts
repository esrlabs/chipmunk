import { Directive, HostListener } from '@angular/core';
import { ilc, Emitter } from '@service/ilc';
import { scope } from '@platform/env/scope';

@Directive({
    selector: '[appInputListener]',
    exportAs: 'appInputListener',
})
export class InputListenerDirective {
    private _emitter: Emitter;

    @HostListener('focus') focus() {
        this._emitter.ui.input.focused();
    }

    @HostListener('blur') blur() {
        this._emitter.ui.input.blur();
    }

    constructor() {
        this._emitter = ilc.emitter('appInputListener', scope.getLogger('appInputListener'));
    }
}
