import { Directive, AfterViewInit, ElementRef } from '@angular/core';

@Directive({
    selector: '[appFocusInput]',
})
export class FocusInputDirective implements AfterViewInit {
    constructor(private host: ElementRef) {}

    ngAfterViewInit() {
        this.host.nativeElement.focus();
    }
}
