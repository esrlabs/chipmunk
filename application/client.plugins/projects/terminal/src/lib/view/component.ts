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
        if (event.key.length === 1) {
            this.ipc.requestToHost({
                stream: this.session,
                command: 'shell',
                post: event.key
            }, this.session).then((response) => {
                console.log(`RES:: ${response}`);
            });
        } else {
            this.ipc.requestToHost({
                stream: this.session,
                command: 'shell',
                post: String.fromCharCode(event.keyCode)
            }, this.session).then((response) => {
                console.log(`RES:: ${response}`);
            });
        }
        /*
        if (event.keyCode === 13) {
            this.ipc.sentToHost({
                stream: this.session,
                command: 'shell',
                post: `${(event.target as HTMLInputElement).value}\n`
            }, this.session);
        }
        */
    }


}
