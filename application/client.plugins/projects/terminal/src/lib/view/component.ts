import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, ElementRef, ViewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
    selector: 'lib-output-bottom',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewComponent implements AfterViewInit, OnDestroy {
    @ViewChild('cmdinput') _ng_input: ElementRef;

    @Input() public ipc: any;
    @Input() public session: string;

    public _ng_safeHtml: SafeHtml = null;

    private _subscription: any;

    constructor(private _cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
    }

    ngOnDestroy() {
        // tslint:disable-next-line:no-unused-expression
        this._subscription !== undefined && this._subscription.destroy();
    }

    ngAfterViewInit() {
        this._subscription = this.ipc.subscribeToHost((message: any) => {
            if (message.streamId === this.session) {
                this._ng_safeHtml = this._sanitizer.bypassSecurityTrustHtml(message.last);
                this._cdRef.detectChanges();
            }
        });
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
        (event.target as HTMLInputElement).value = '';
    }


}
