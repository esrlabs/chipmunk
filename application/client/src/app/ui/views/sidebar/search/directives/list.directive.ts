import { Directive, Input, HostListener } from '@angular/core';
import { DragAndDropService, ListContent } from '../draganddrop/service';

@Directive({
    selector: '[appListDirective]',
})
export class ListDirective {
    @Input() listID!: ListContent;
    @Input() draganddrop!: DragAndDropService;

    @HostListener('mouseover', ['$event']) onMouseOver() {
        this.draganddrop.onMouseOver(this.listID);
    }
}
