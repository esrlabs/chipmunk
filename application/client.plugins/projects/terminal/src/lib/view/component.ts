import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input } from '@angular/core';
import ServiceElectronIpc, { IPCMessages } from 'logviewer.client.electron.ipc';

@Component({
    selector: 'lib-view',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewComponent implements AfterViewInit, OnDestroy {

    @Input() public title: string;
    public items: string[] = [];

    private _timer: any = -1;

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    ngOnDestroy() {
        clearTimeout(this._timer);
    }

    ngAfterViewInit() {
        this._next();
        ServiceElectronIpc.subscribe(IPCMessages.PluginMessage, (message: IPCMessages.PluginMessage) => {
            this.items.push(...message.message.split(/[\n\r]/gi));
        });
    }

    private _next() {
        this._timer = setTimeout(() => {
            this.title = Math.random() + '';
            this._next();
        }, 500);
    }


}
