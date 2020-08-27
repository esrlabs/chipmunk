import { Directive, Input, OnDestroy, HostListener } from '@angular/core';
import { Subscription } from 'rxjs';

import SearchManagerService, { EListID } from '../service/service';

@Directive({
    selector: '[appSidebarSearchManagerList]',
})

export class SidebarAppSearchManagerListDirective implements OnDestroy {

    @Input() listID: EListID;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _droppedOut: boolean;
    private _ignore: boolean;

    get droppedOut(): boolean {
        return this._droppedOut;
    }

    @HostListener('mouseover', ['$event']) onMouseOver(event: MouseEvent) {
        SearchManagerService.onMouseOver(this.listID);
    }

    constructor() {
        this._subscriptions.mouseOver = SearchManagerService.getObservable().mouseOver.subscribe(this._onMouseOver.bind(this));
        this._subscriptions.mouseOverGlobal = SearchManagerService.getObservable().mouseOverGlobal.subscribe(this._onMouseOverGlobal.bind(this));
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _onMouseOver(listID: EListID) {
        this._ignore = true;
        this._droppedOut = false;
    }

    private _onMouseOverGlobal() {
        if (!this._ignore) {
            this._droppedOut = true;
        } else {
            this._ignore = false;
        }
    }

}
