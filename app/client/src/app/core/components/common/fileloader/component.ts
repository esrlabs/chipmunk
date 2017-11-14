import {Component, ViewChild, ViewContainerRef, Output, EventEmitter, OnDestroy } from '@angular/core';
import { Handles } from './interface';

@Component({
    selector    : 'file-loader',
    templateUrl : './template.html',
})

export class FileLoader implements OnDestroy{

    @ViewChild('input', { read: ViewContainerRef}) input: ViewContainerRef;

    @Output() closer : EventEmitter<any> = new EventEmitter();

    private handles : {
        onLoad      : Function,
        onError     : Function,
        onReading   : Function
    } = {
        onLoad      : null,
        onError     : null,
        onReading   : null
    };

    private minimalMouseoverEvents  : number            = 10;
    private refMouseoverHandle      : EventListener     = null;
    private files                   : Array<File>       = [];

    constructor() {
        this.refMouseoverHandle = this.onMouseover.bind(this);
        window.addEventListener('mousemove', this.refMouseoverHandle);
    }

    ngOnDestroy(){
        window.removeEventListener('mousemove', this.refMouseoverHandle);
    }

    onMouseover(event : MouseEvent){
        if (this.minimalMouseoverEvents >= 0){
            this.minimalMouseoverEvents -= 1;
        } else {
            this.close();
        }
    }

    open(handles : Handles){
        this.handles.onLoad     = typeof handles.load       === 'function' ? handles.load       : null;
        this.handles.onError    = typeof handles.error      === 'function' ? handles.error      : null;
        this.handles.onReading  = typeof handles.reading    === 'function' ? handles.reading    : null;
        this.input.element.nativeElement.click();
    }

    close(){
        this.closer.emit();
    }

    onChange(event: any){
        let reader  = new FileReader(),
            file    = event.target.files[0] !== void 0 ? event.target.files[0] : null;
        if (file !== null){
            this.files = event.target.files;
            this.handles.onReading !== null && this.handles.onReading(file);
            reader.addEventListener('load',     this.onLoad.bind(this));
            reader.addEventListener('error',    this.onError.bind(this));
            reader.readAsBinaryString(file);
        } else {
            this.close();
        }
    }

    onLoad(event: any){
        this.handles.onLoad(event.target.result, this.files);
    }

    onError(event: Event){
        this.handles.onError(event);
    }
}
