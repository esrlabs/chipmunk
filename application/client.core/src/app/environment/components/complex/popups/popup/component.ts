import { Component, Input, HostBinding, AfterContentInit, AfterViewInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import PopupsService from '../../../../services/standalone/service.popups';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-popup',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class PopupComponent implements AfterContentInit, AfterViewInit, OnDestroy {

    @Input() public popup: Toolkit.IPopup = { caption: '', message: '' };

    @HostBinding('style.width') width = '24rem';
    @HostBinding('style.margin-left') marginLeft = '-12rem';

    private _subscriptions: { [key: string]: Subscription } = {};

    @Input() public onClose: (...args: any[]) => any = () => {};

    constructor() {
        this._subscriptions.adjustWidth = PopupsService.getObservable().onAdjustWidth.subscribe(this._onAdjustWidth.bind(this));
    }

    public ngAfterContentInit() {
        if (this.popup.options === undefined) {
            return;
        }
        if (this.popup.options.width !== undefined) {
            this.width = `${this.popup.options.width}rem`;
            this.marginLeft = `-${this.popup.options.width / 2}rem`;
        }
    }

    public ngAfterViewInit() {
        const containers = Array.from(document.getElementsByClassName('buttons'));
        if (containers.length > 0 && containers[0].firstChild !== null) {
            (containers[0].firstChild as HTMLElement).focus();
        }
        if (typeof this.popup.afterOpen === 'function') {
            this.popup.afterOpen();
        }
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _onAdjustWidth() {
        this.width = 'auto';
        this.marginLeft = `-${this.popup.options.width / 2}rem`;
    }
}
