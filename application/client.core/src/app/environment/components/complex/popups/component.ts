import { Component, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import * as Toolkit from 'chipmunk.client.toolkit';

import PopupsService from '../../../services/standalone/service.popups';

@Component({
    selector: 'app-popups',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class PopupsComponent implements OnDestroy {
    private _subscriptions: { [key: string]: Subscription } = {};
    private _popups: Toolkit.IPopup[] = [];

    public popups: Toolkit.IPopup[] = [];

    constructor(private _cdRef: ChangeDetectorRef) {
        this._subscriptions.onNew = PopupsService.getObservable().onNew.subscribe(
            this._onNew.bind(this),
        );
        this._subscriptions.onRemove = PopupsService.getObservable().onRemove.subscribe(
            this._onRemove.bind(this),
        );
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public onClose(popup: Toolkit.IPopup) {
        popup.id && this._remove(popup.id);
    }

    public _ng_clickOutside() {
        PopupsService.close();
    }

    private _onNew(popup: Toolkit.IPopup) {
        const valid_popup = this._normalize(popup);
        if (valid_popup === undefined) {
            return;
        }
        this._popups.push(valid_popup);
        this.popups.push(valid_popup);
        this._cdRef.detectChanges();
    }

    private _onRemove(guid: string) {
        this._remove(guid);
    }

    private _normalize(popup: Toolkit.IPopup): Toolkit.IPopup | undefined {
        if (typeof popup !== 'object' || popup === null) {
            return undefined;
        }
        if (typeof popup.caption !== 'string') {
            return undefined;
        }
        popup.id =
            typeof popup.id === 'string'
                ? popup.id.trim() !== ''
                    ? popup.id
                    : Toolkit.guid()
                : Toolkit.guid();
        popup.options =
            typeof popup.options === 'object' ? (popup.options !== null ? popup.options : {}) : {};
        popup.options.closable =
            typeof popup.options.closable === 'boolean' ? popup.options.closable : true;
        popup.options.minimalistic =
            typeof popup.options.minimalistic === 'boolean' ? popup.options.minimalistic : false;
        popup.buttons = popup.buttons instanceof Array ? popup.buttons : [];
        popup.buttons = popup.buttons
            .map((button) => {
                if (typeof button.caption !== 'string' || button.caption.trim() === '') {
                    return null;
                }
                if (typeof button.handler !== 'function') {
                    return null;
                }
                button.handler = this._onButtonClick.bind(this, popup.id as string, button.handler);
                return button;
            })
            .filter((button) => button !== null) as Toolkit.IButton[];
        if (typeof popup.message === 'string' && popup.message.trim() !== '') {
            popup.component = void 0;
            return popup;
        }
        if (
            typeof popup.component === 'object' &&
            popup.component !== null &&
            popup.component.factory !== void 0
        ) {
            popup.message = void 0;
            popup.component.inputs =
                typeof popup.component.inputs === 'object'
                    ? popup.component.inputs !== null
                        ? popup.component.inputs
                        : {}
                    : {};
            return popup;
        } else {
            return undefined;
        }
    }

    private _onButtonClick(id: string, handler: (...args: any[]) => any) {
        this._remove(id);
        handler();
    }

    private _remove(id: string) {
        const removed = this.popups.find((popup) => popup.id === id);
        if (removed === undefined) {
            return;
        }
        this.popups = this.popups.filter((popup) => popup.id !== id);
        if (typeof removed.beforeClose === 'function') {
            removed.beforeClose();
        }
        PopupsService.clear(id);
        this._cdRef.detectChanges();
    }
}
