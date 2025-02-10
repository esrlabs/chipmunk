import { Directive, OnDestroy, Output, EventEmitter, ElementRef } from '@angular/core';
import { bridge } from '@service/bridge';
import { File as OwnFileDef } from '@platform/types/files';
import { stop } from '@ui/env/dom';

// Property 'path' exists, but it doesn't a part of specification
export interface GlobalFileDef extends File {
    path: string;
}

@Directive({
    selector: '[appMatDragDropFileFeature]',
    standalone: false,
})
export class MatDragDropFileFeatureDirective implements OnDestroy {
    @Output() dropped: EventEmitter<OwnFileDef[]> = new EventEmitter();

    protected drop(event: DragEvent): void {
        stop(event);
        const files: string[] = this.getFiles(event);
        if (files.length === 0) {
            return;
        }
        bridge
            .files()
            .getByPath(files)
            .then((files) => {
                this.dropped.emit(files);
            });
    }

    protected stop(event: MouseEvent): boolean {
        return stop(event);
    }

    protected getFiles(event: DragEvent): string[] {
        if (event.dataTransfer === null || event.dataTransfer === undefined) {
            return [];
        }
        const files = (() => {
            if (event.dataTransfer.files) {
                return Array.from(event.dataTransfer.files).map((f) =>
                    window.electron.webUtils.getPathForFile(f),
                );
            } else if (event.dataTransfer.items) {
                return (
                    Array.from(event.dataTransfer.items)
                        .map((item: DataTransferItem) => {
                            if (item.kind === 'file') {
                                return item.getAsFile();
                            } else {
                                return undefined;
                            }
                        })
                        .filter((f) => f !== undefined) as File[]
                ).map((f) => window.electron.webUtils.getPathForFile(f));
            } else {
                return [];
            }
        })();
        return files;
    }

    constructor(protected readonly element: ElementRef<HTMLDivElement>) {
        // Note: The files property of DataTransfer objects can only be accessed from within
        // the drop event. For all other events, the files property will be empty — because
        // its underlying data store will be in a protected mode.
        // https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/files
        //
        // Using of @HostBinding doesn't work always smooth and looks like
        // "protected mode" is a reason.
        //
        // That's why we are binding event's handlers directly to DOM elements
        this.stop = this.stop.bind(this);
        this.drop = this.drop.bind(this);
        this.element.nativeElement.addEventListener('dragover', this.stop);
        this.element.nativeElement.addEventListener('dragleave', this.stop);
        this.element.nativeElement.addEventListener('drop', this.drop);
    }

    public ngOnDestroy(): void {
        this.element.nativeElement.removeEventListener('dragover', this.stop);
        this.element.nativeElement.removeEventListener('dragleave', this.stop);
        this.element.nativeElement.removeEventListener('drop', this.drop);
    }
}
