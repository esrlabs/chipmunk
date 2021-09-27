// application\client.core\src\app\environment\directives\focus.button.directive.ts
import { AfterViewInit, Directive, ElementRef } from '@angular/core';

@Directive({
    selector: '[appFocusDefaultButton]',
})
export class FocusDefaultButtonDirective implements AfterViewInit {
    constructor(private _hostElement: ElementRef) {}

    public ngAfterViewInit() {
        (this._hostElement.nativeElement as HTMLElement).focus();
    }
}
