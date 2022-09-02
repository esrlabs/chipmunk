import { Directive, HostListener, Output, EventEmitter } from '@angular/core';

// Property 'path' exists, but TS does not detect it
export interface FileDropped extends File {
    path: string;
}

@Directive({
    selector: '[appMatDragDropFileFeature]',
})
export class MatDragDropFileFeatureDirective {
    @Output() drop: EventEmitter<FileDropped[]> = new EventEmitter();

    @HostListener('dragover', ['$event']) _mouseOver(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
    }

    @HostListener('dragleave', ['$event']) _mouseOut(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
    }

    @HostListener('drop', ['$event']) _mouseUp(event: DragEvent) {
        if (event.dataTransfer !== null && event.dataTransfer !== undefined) {
            const files: FileList = event.dataTransfer.files;
            this.drop.emit(
                Array.from(files).map((file) => {
                    return file as FileDropped;
                }),
            );
        }
    }
}
