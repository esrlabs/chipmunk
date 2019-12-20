import { Component, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import * as Toolkit from 'chipmunk.client.toolkit';

import PopupsService from '../../../services/standalone/service.popups';


@Component({
    selector: 'app-popups',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class PopupsComponent implements OnDestroy {

    private _subscriptions: { [key: string]: Subscription } = {};
    private _popups: Toolkit.IPopup[] = [];

    public popups: Toolkit.IPopup[] = [];

    constructor(private _cdRef: ChangeDetectorRef) {
        this._subscriptions.onNew = PopupsService.getObservable().onNew.subscribe(this._onNew.bind(this));
        this._subscriptions.onRemove = PopupsService.getObservable().onRemove.subscribe(this._onRemove.bind(this));
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public onClose(popup: Toolkit.IPopup) {
        this._remove(popup.id);
    }

    private _onNew(popup: Toolkit.IPopup) {
        popup = this._normalize(popup);
        if (popup === null) {
            return false;
        }
        this._popups.push(popup);
        this.popups.push(popup);
        this._cdRef.detectChanges();
    }

    private _onRemove(guid: string) {
        this._remove(guid);
    }

    private _normalize(popup: Toolkit.IPopup): Toolkit.IPopup | null {
        if (typeof popup !== 'object' || popup === null) {
            return null;
        }
        if (typeof popup.caption !== 'string') {
            return null;
        }
        popup.id = typeof popup.id === 'string' ? (popup.id.trim() !== '' ? popup.id : Toolkit.guid()) : Toolkit.guid();
        popup.options = typeof popup.options === 'object' ? (popup.options !== null ? popup.options : {}) : {};
        popup.options.closable = typeof popup.options.closable === 'boolean' ? popup.options.closable : true;
        popup.options.minimalistic = typeof popup.options.minimalistic === 'boolean' ? popup.options.minimalistic : false;
        popup.buttons = popup.buttons instanceof Array ? popup.buttons : [];
        popup.buttons = popup.buttons.map((button) => {
            if (typeof button.caption !== 'string' || button.caption.trim() === '') {
                return null;
            }
            if (typeof button.handler !== 'function') {
                return null;
            }
            button.handler = this._onButtonClick.bind(this, popup.id, button.handler);
            return button;
        }).filter(button => button !== null);
        if (typeof popup.message === 'string' && popup.message.trim() !== '') {
            popup.component = void 0;
            return popup;
        }
        if (typeof popup.component === 'object' && popup.component !== null && popup.component.factory !== void 0) {
            popup.message = void 0;
            popup.component.inputs = typeof popup.component.inputs === 'object' ? (popup.component.inputs !== null ? popup.component.inputs : {}) : {};
            return popup;
        }
    }

    private _onButtonClick(id: string, handler: (...args: any[]) => any) {
        this._remove(id);
        handler();
    }

    private _remove(id: string) {
        this.popups = this.popups.filter(popup => popup.id !== id);
        PopupsService.clear(id);
        this._cdRef.detectChanges();
    }

    private _update(id: string, updated: any): boolean {
        let index: number = -1;
        this.popups.forEach((notify: Toolkit.IPopup, i: number) => {
            if (index !== -1) {
                return;
            }
            if (notify.id === id) {
                index = i;
            }
        });
        if (index === -1) {
            return false;
        }
        Object.keys(updated).forEach((key: string) => {
            this.popups[index][key] = updated[key];
        });
        return true;
    }

}
