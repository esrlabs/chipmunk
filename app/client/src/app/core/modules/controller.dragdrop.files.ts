import { Logs, TYPES } from '../modules/tools.logs';
import {EventEmitter} from "@angular/core";

const EVENTS = {
    drop    : 'drop',
    dragover: 'dragover',
    dragend : 'dragend',
    load    : 'load',
    error   : 'error'
};

type DragDropFileEvent = { content: string, description: string, error?: Error };

class DragAndDropFiles{

    private _target         : HTMLElement   = null;
    private _content        : string        = '';

    public onStart  : EventEmitter<DragDropFileEvent> = new EventEmitter();
    public onFinish : EventEmitter<DragDropFileEvent> = new EventEmitter();

    constructor(target: HTMLElement){
        if (target){
            this._target        = target;
            this._onDrop        = this._onDrop.bind(this);
            this._onDragOver    = this._onDragOver.bind(this);
            this._onDragEnd     = this._onDragEnd.bind(this);
            this._bind();
        }
    }

    _bind(){
        this._target.addEventListener(EVENTS.drop,      this._onDrop);
        this._target.addEventListener(EVENTS.dragover,  this._onDragOver);
        this._target.addEventListener(EVENTS.dragend,   this._onDragEnd);
    }

    _unbind(){
        this._target.removeEventListener(EVENTS.drop,      this._onDrop);
        this._target.removeEventListener(EVENTS.dragover,  this._onDragOver);
        this._target.removeEventListener(EVENTS.dragend,   this._onDragEnd);
    }

    _onDrop(event: DragEvent){

        if (this._content !== '') {
            return false;
        }

        let data = event.dataTransfer;
        let files: Array<File> = [];

        if (data.items) {
            Array.prototype.forEach.call(data.items, (item: DataTransferItem) => {
                if (item.kind === 'file'){
                    const file = item.getAsFile();
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

        event.preventDefault();

        const description =  files.map((file: File) => {
            return file.name;
        }).join(', ');

        this.onStart.emit({
            content     : '',
            description : description
        });

        Promise.all(files.map((file: File) => {
                return this._read(file);
            }))
            .then(() => {
                const str = this._content;
                this._content = '';
                this.onFinish.emit({
                    content     : str,
                    description : description
                });
            })
            .catch((error: Error) => {
                this._content = '';
                this.onFinish.emit({
                    content     : '',
                    description : '',
                    error       : error
                });
                Logs.msg(`Error during reading file (drag & drop): ${error.message}`, TYPES.DEBUG);
            });
    }

    _onDragOver(event: DragEvent){
        event.preventDefault();
    }

    _onDragEnd(event: DragEvent){
        let data = event.dataTransfer;
        if (data.items) {
            Array.prototype.forEach.call(data.items, (item: DataTransferItem, index: number) => {
                data.items.remove(index);
            });
        } else {
            event.dataTransfer.clearData();
        }
    }

    _read(file: File){
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            fileReader.addEventListener(EVENTS.load,   (event: any) => {
                this._content += event.currentTarget.result;
                resolve(event.currentTarget.result);
            });
            fileReader.addEventListener(EVENTS.error, (error: ErrorEvent) => {
                reject(error.error);
            });
            fileReader.readAsBinaryString(file);
        });
    }


}

export { DragAndDropFiles, DragDropFileEvent };