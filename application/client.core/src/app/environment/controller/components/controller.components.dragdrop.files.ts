import { Observable, Subject } from 'rxjs';

export class ControllerComponentsDragDropFiles {
    private _element: HTMLElement;
    private _subjects = {
        onFiles: new Subject<File[]>(),
    };

    constructor(element: HTMLElement) {
        this._element = element;
        this._onDrop = this._onDrop.bind(this);
        this._onDragEnd = this._onDragEnd.bind(this);
        this._onDragOver = this._onDragOver.bind(this);
        this._bind();
    }

    public destroy() {
        this._unbind();
    }

    public getObservable(): {
        onFiles: Observable<File[]>;
    } {
        return {
            onFiles: this._subjects.onFiles.asObservable(),
        };
    }

    private _bind() {
        this._element.addEventListener('drop', this._onDrop);
        this._element.addEventListener('dragover', this._onDragOver);
        this._element.addEventListener('dragend', this._onDragEnd);
    }

    private _unbind() {
        this._element.removeEventListener('drop', this._onDrop);
        this._element.removeEventListener('dragover', this._onDragOver);
        this._element.removeEventListener('dragend', this._onDragEnd);
    }

    private _onDrop(event: DragEvent) {
        const data: DataTransfer | null = event.dataTransfer;
        if (data === null) {
            return false;
        }
        const files: File[] = [];
        if (data.items) {
            Array.prototype.forEach.call(data.items, (item: DataTransferItem) => {
                if (item.kind === 'file') {
                    const file: File | null = item.getAsFile();
                    if (file === null) {
                        return;
                    }
                    files.push(file);
                }
            });
        } else if (data.files) {
            Array.prototype.forEach.call(data.files, (file: File) => {
                files.push(file);
            });
        }
        if (files.length === 0) {
            return false;
        }
        this._subjects.onFiles.next(files);
        event.preventDefault();
        return false;
    }

    private _onDragOver(event: DragEvent) {
        event.preventDefault();
        return false;
    }

    private _onDragEnd(event: DragEvent) {
        const data: DataTransfer | null = event.dataTransfer;
        if (data === null) {
            return false;
        }
        if (data.items) {
            Array.prototype.forEach.call(data.items, (item: DataTransferItem, index: number) => {
                data.items.remove(index);
            });
        } else {
            data.clearData();
        }
        return;
    }
}
