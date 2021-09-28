import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    ViewChild,
    AfterViewInit,
    ElementRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { IComponentDesc } from 'chipmunk-client-material';
import ContextMenuService, {
    IMenu,
    IMenuItem,
    EEventType,
} from '../../services/standalone/service.contextmenu';
import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-layout-contextmenu',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class LayoutContextMenuComponent implements OnDestroy, AfterViewInit {
    @ViewChild('menu') _ng_menu!: ElementRef;

    public _ng_component: IComponentDesc | undefined;
    public _ng_items: IMenuItem[] | undefined;
    public _ng_guid: string = Toolkit.guid();

    private _subscriptions: { [key: string]: Subscription } = {};
    private _top: number = 0;
    private _left: number = 0;

    constructor(private _cdRef: ChangeDetectorRef) {
        this._subscriptions.onShow = ContextMenuService.getObservable().onShow.subscribe(
            this._onShow.bind(this),
        );
        this._subscriptions.onRemove = ContextMenuService.getObservable().onRemove.subscribe(
            this._remove.bind(this),
        );
    }

    public get _ng_top() {
        return `${this._top}px`;
    }

    public get _ng_left() {
        return `${this._left}px`;
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._unsubscribeToWinEvents();
    }

    public ngAfterViewInit() {
        this._subscribeToWinEvents();
    }

    public _ng_onMouseDown(item: IMenuItem) {
        if (typeof item.handler !== 'function') {
            return;
        }
        if (item.disabled) {
            return;
        }
        item.handler();
        this._remove();
    }

    private _onShow(menu: IMenu) {
        this._ng_component = menu.component;
        this._ng_items = menu.items;
        this._top = menu.y;
        this._left = menu.x;
        this._cdRef.detectChanges();
        // Recheck position
        setTimeout(() => {
            if (this._ng_menu === undefined || this._ng_menu === null) {
                return;
            }
            const size: ClientRect = (
                this._ng_menu.nativeElement as HTMLElement
            ).getBoundingClientRect();
            if (window.innerWidth < size.width + menu.x) {
                this._left = window.innerWidth - size.width;
            }
            if (window.innerHeight < size.height + menu.y) {
                this._top = window.innerHeight - size.height;
            }
            if (this._top !== menu.y || this._left !== menu.x) {
                this._cdRef.detectChanges();
            }
        }, 0);
    }

    private _subscribeToWinEvents() {
        ContextMenuService.subscribeToWinEvents(
            EEventType.keydown,
            this._onWindowKeyDown.bind(this),
        );
        ContextMenuService.subscribeToWinEvents(
            EEventType.mousedown,
            this._onWindowMouseDown.bind(this),
        );
    }

    private _unsubscribeToWinEvents() {
        ContextMenuService.unsubscribeToWinEvents(
            EEventType.keydown,
            this._onWindowKeyDown.bind(this),
        );
        ContextMenuService.unsubscribeToWinEvents(
            EEventType.mousedown,
            this._onWindowMouseDown.bind(this),
        );
    }

    private _onWindowKeyDown(event: KeyboardEvent) {
        if (
            this._isContextMenuNode(event.target as HTMLElement) ||
            (event.key !== 'Escape' && event.key !== 'Enter')
        ) {
            return false;
        }
        this._remove();
        return;
    }

    private _onWindowMouseDown(event: MouseEvent) {
        if (this._isContextMenuNode(event.target as HTMLElement)) {
            return false;
        }
        this._remove();
        return;
    }

    private _remove() {
        this._ng_component = undefined;
        this._ng_items = undefined;
        this._top = 0;
        this._left = 0;
        this._cdRef.detectChanges();
    }

    private _isContextMenuNode(node: HTMLElement): boolean {
        if (typeof node.nodeName === 'string' && node.nodeName.toLowerCase() === 'body') {
            return false;
        }
        if (typeof node.getAttribute === 'function' && node.getAttribute('id') === this._ng_guid) {
            return true;
        }
        if (node.parentNode !== undefined && node.parentNode !== null) {
            return this._isContextMenuNode(node.parentNode as HTMLElement);
        }
        return false;
    }
}
