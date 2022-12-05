import { Directive, HostListener, Output, EventEmitter } from '@angular/core';
import { bridge } from '@service/bridge';
import { File as OwnFileDef } from '@platform/types/files';

// Property 'path' exists, but it doesn't a part of specification
export interface GlobalFileDef extends File {
    path: string;
}

@Directive({
    selector: '[appMatDragDropFileFeature]',
})
export class MatDragDropFileFeatureDirective {
    @Output() dropped: EventEmitter<OwnFileDef[]> = new EventEmitter();

    @HostListener('dragover', ['$event']) dragover(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
    }

    @HostListener('dragleave', ['$event']) dragleave(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
    }

    @HostListener('drop', ['$event']) drop(event: DragEvent) {
        if (event.dataTransfer === null || event.dataTransfer === undefined) {
            return;
        }
        const files: FileList = event.dataTransfer.files;
        bridge
            .files()
            .getByPath(Array.from(files).map((f) => (f as GlobalFileDef).path))
            .then((files) => {
                this.dropped.emit(files);
            });
    }
}