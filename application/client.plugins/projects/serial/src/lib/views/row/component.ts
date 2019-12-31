// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, AfterContentInit, Input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import ServiceSignatures, { ISignature } from '../../services/service.signatures';
import * as Toolkit from 'chipmunk.client.toolkit';
import { Subscription, Subject } from 'rxjs';

@Component({
    selector: 'lib-serial-row-component',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SerialRowComponent implements AfterViewInit, OnDestroy, AfterContentInit {

    @Input() public api: Toolkit.IAPI;
    @Input() public session: string;
    @Input() public html: string;
    @Input() public update: Subject<{ [key: string]: any }>;

    public _ng_html: SafeHtml;
    public _ng_color: string = '';
    public _ng_title: string = '';

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {

    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterViewInit() {
        if (typeof this.html !== 'string') {
            return;
        }
        this._getHTML();
    }

    public ngAfterContentInit() {
        if (this.update === undefined) {
            return;
        }
        this._subscriptions.update = this.update.asObservable().subscribe(this._onInputsUpdated.bind(this));
    }

    private _onInputsUpdated(inputs: any) {
        if (inputs === undefined || inputs === null) {
            return;
        }
        if (typeof inputs.html === 'string' && inputs.html !== this.html) {
            this.html = inputs.html;
            this._getHTML();
        }
    }

    private _getHTML() {
        const signature: ISignature = ServiceSignatures.getSignature(this.html);
        this._ng_html = this._sanitizer.bypassSecurityTrustHtml(signature.clean);
        this._ng_color = signature.color;
        this._ng_title = signature.title;
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
