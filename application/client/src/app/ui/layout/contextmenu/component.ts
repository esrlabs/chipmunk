import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    ViewChild,
    AfterViewInit,
    ElementRef,
} from '@angular/core';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';
import { unique } from '@platform/env/sequence';

@Component({
    selector: 'app-layout-contextmenu',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class LayoutContextMenu implements OnDestroy, AfterViewInit {
    @ViewChild('menu') _ng_menuRef!: ElementRef;

    public _ng_menu: Declarations.IMenu | undefined;
    public _ng_guid: string = unique();

    private _top: number = 0;
    private _left: number = 0;

    constructor(private _cdRef: ChangeDetectorRef) {
        this.ilc().channel.ui.contextmenu.open(this._open.bind(this));
        this.ilc().channel.ui.contextmenu.close(this._remove.bind(this));
    }

    public get _ng_top() {
        return `${this._top}px`;
    }

    public get _ng_left() {
        return `${this._left}px`;
    }

    public ngOnDestroy() {
        window.removeEventListener('keydown', this._onWindowKeyDown);
        window.removeEventListener('mousedown', this._onWindowMouseDown);
    }

    public ngAfterViewInit() {
        this._onWindowKeyDown = this._onWindowKeyDown.bind(this);
        this._onWindowMouseDown = this._onWindowMouseDown.bind(this);
        window.addEventListener('keydown', this._onWindowKeyDown, true);
        window.addEventListener('mousedown', this._onWindowMouseDown, true);
    }

    public _ng_onMouseDown(item: Declarations.IMenuItem) {
        if (typeof item.handler !== 'function') {
            return;
        }
        if (item.disabled) {
            return;
        }
        item.handler();
        if (this._ng_menu !== undefined && this._ng_menu.after !== undefined) {
            this._ng_menu.after();
        }
        this._remove();
    }

    private _open(menu: Declarations.IMenu) {
        this._ng_menu = menu;
        this._top = menu.y;
        this._left = menu.x;
        this._cdRef.detectChanges();
        // Recheck position
        setTimeout(() => {
            if (this._ng_menuRef === undefined || this._ng_menuRef === null) {
                return;
            }
            const size: ClientRect = (
                this._ng_menuRef.nativeElement as HTMLElement
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
        });
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
        this._ng_menu = undefined;
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
export interface LayoutContextMenu extends IlcInterface {}
