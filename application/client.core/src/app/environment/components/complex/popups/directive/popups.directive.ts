import { Directive, ElementRef, OnInit } from '@angular/core';

@Directive({
    selector: '[appComplexPopups]',
})

export class ComplexPopupsDirective implements OnInit {

    constructor(private element: ElementRef) { }

    ngOnInit() {
        this.element.nativeElement.focus();
    }
}
