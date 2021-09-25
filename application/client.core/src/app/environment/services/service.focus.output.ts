import { Observable, Subject, Subscription } from 'rxjs';
import { ComplexScrollBoxComponent } from 'chipmunk-client-material';

import HotkeysService from './service.hotkeys';

import * as Toolkit from 'chipmunk.client.toolkit';

export class FocusOutputService {
    private _logger: Toolkit.Logger = new Toolkit.Logger('FocusOutputService');
    private _subscriptions: { [key: string]: Subscription } = {};
    private _scrollBoxComs: ComplexScrollBoxComponent[] = [];
    private _subjects: {
        onFocus: Subject<void>;
    } = {
        onFocus: new Subject<void>(),
    };

    constructor() {
        HotkeysService.getObservable().scrollToBegin.subscribe(this._onScrollBegin.bind(this));
        HotkeysService.getObservable().scrollToEnd.subscribe(this._onScrollEnd.bind(this));
    }

    public getObservable(): {
        onFocus: Observable<void>;
    } {
        return {
            onFocus: this._subjects.onFocus.asObservable(),
        };
    }

    public getName(): string {
        return 'FocusOutputService';
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
            resolve();
        });
    }

    public addScrollbox(scrollBoxCom: ComplexScrollBoxComponent) {
        this._scrollBoxComs.push(scrollBoxCom);
    }

    public removeScrollbox(scrollBoxCom: ComplexScrollBoxComponent) {
        this._scrollBoxComs = this._scrollBoxComs.filter((scrollbox: ComplexScrollBoxComponent) => {
            return scrollbox._ng_guid !== scrollBoxCom._ng_guid;
        });
    }

    public focus() {
        return this._subjects.onFocus.next();
    }

    private _onScrollBegin() {
        const scrollBox: Element | undefined = this._getActiveScrollBox();
        if (scrollBox === undefined) {
            return;
        }
        this._scrollBoxComs.forEach((scrollBoxCom: ComplexScrollBoxComponent) => {
            if (scrollBoxCom._ng_guid === scrollBox.id) {
                scrollBoxCom.scrollToBegin();
            }
        });
    }

    private _onScrollEnd() {
        const scrollBox: Element | undefined = this._getActiveScrollBox();
        if (scrollBox === undefined) {
            return;
        }
        this._scrollBoxComs.forEach((scrollBoxCom: ComplexScrollBoxComponent) => {
            if (scrollBoxCom._ng_guid === scrollBox.id) {
                scrollBoxCom.scrollToEnd();
            }
        });
    }

    private _getActiveScrollBox(): Element | undefined {
        let element: Element | undefined;
        if (document.activeElement === null) {
            return undefined;
        }
        Array.from(document.activeElement.children).forEach((child: Element) => {
            if (child.tagName === 'UL') {
                element = child;
            }
        });
        return element;
    }
}

export default new FocusOutputService();
