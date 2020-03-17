import { Directive, ChangeDetectorRef, OnInit, OnDestroy, Input, HostBinding, HostListener, Host, Self, Optional, NgZone, ViewContainerRef } from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';
import { MatInput } from '@angular/material/input';

@Directive({
    selector: '[appSidebarSearchManagerItem]',
})

export class SidebarAppSearchManagerItemDirective implements OnInit, OnDestroy {

    @Input() select: Observable<string>;
    @Input() edit: Observable<string>;
    @Input() selected: Subject<string>;
    @Input() input: MatInput;

    public _ng_edit: boolean = false;
    public _ng_selected: boolean = false;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _guid: string | undefined;
    private _destroyed: boolean = false;
    private _ignore: boolean = false;

    @HostBinding('class.selected') get cssClassSelected() {
        return this._ng_selected;
    }
    @HostBinding('class.edited') get cssClassEdited() {
        return this._ng_edit;
    }
    @HostListener('click', ['$event.target']) onClick() {
        if (this._ignore) {
            this._ignore = false;
            return;
        }
        if (this._ng_edit) {
            return;
        }
        this._zone.run(() => {
            this.selected.next(this._guid);
            this._forceUpdate();
        });
    }

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _zone: NgZone,
        private _view: ViewContainerRef,
    ) { }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngOnInit() {
        this._subscriptions.edit = this.edit.subscribe(this._onEditIn.bind(this));
        this._subscriptions.select = this.select.subscribe(this._onSelected.bind(this));
    }

    public setGuid(guid: string) {
        this._guid = guid;
    }

    public setEditFlag(flag: boolean) {
        this._zone.run(() => {
            this._ng_edit = flag;
            this._forceUpdate();
        });
    }

    public setSelectFlag(flag: boolean) {
        this._zone.run(() => {
            this._ng_selected = flag;
            this._forceUpdate();
        });
    }

    public getEditFlag(): boolean {
        return this._ng_edit;
    }

    public getSelectFlag(): boolean {
        return this._ng_selected;
    }

    public ignoreMouseClick(event: MouseEvent) {
        this._ignore = true;
    }

    private _getInputRef(): MatInput | undefined {
        if ((this._view as any)._data === undefined) {
            return undefined;
        }
        if ((this._view as any)._data.componentView === undefined) {
            return undefined;
        }
        if ((this._view as any)._data.componentView.component === undefined) {
            return undefined;
        }
        return (this._view as any)._data.componentView.component.getInputRef();
    }

    private _onEditIn(guid: string) {
        this._zone.run(() => {
            this._ng_edit = this._guid === guid;
            if (this._ng_edit) {
                setTimeout(() => {
                    if (this._getInputRef() === undefined) {
                        return;
                    }
                    this._getInputRef().focus();
                });
            }
            this._forceUpdate();
        });
    }

    private _onSelected(guid: string) {
        this._zone.run(() => {
            this._ng_selected = this._guid === guid ? !this._ng_selected : false;
            if (!this._ng_selected) {
                this._ng_edit = false;
            }
            this._forceUpdate();
        });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
