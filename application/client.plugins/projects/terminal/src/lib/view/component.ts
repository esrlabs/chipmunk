import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, ElementRef, ViewChild } from '@angular/core';

@Component({
    selector: 'lib-output-bottom',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewComponent implements AfterViewInit, OnDestroy {
    @ViewChild('cmdinput') _ng_input: ElementRef;

    @Input() public ipc: any;
    @Input() public session: string;

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    ngOnDestroy() {
    }

    ngAfterViewInit() {

    }

    public _ng_onKeyUp(event: KeyboardEvent) {
        if (event.keyCode === 13) {
            this.ipc.sentToHost({
                stream: this.session,
                command: 'shell',
                post: `${(event.target as HTMLInputElement).value}\n`
            }, this.session);
        }
    }


}
