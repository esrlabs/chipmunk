import { Directive, ChangeDetectorRef, OnInit, OnDestroy, Input, HostBinding, HostListener, NgZone, ViewContainerRef } from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';
import { Entity } from '../providers/entity';
import { Provider, ISelectEvent } from '../providers/provider';

@Directive({
    selector: '[appSidebarSearchManagerItem]',
})

export class SidebarAppSearchManagerItemDirective implements OnInit, OnDestroy {

    @Input() provider: Provider<any>;
    @Input() entity: Entity<any>;

    public _ng_edit: boolean = false;
    public _ng_selected: boolean = false;

    private _subscriptions: { [key: string]: Subscription } = {};
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
            this.provider.select().set(this.entity.getGUID());
            this._forceUpdate();
        });
    }

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _zone: NgZone,
        private _view: ViewContainerRef,
    ) {
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngOnInit() {
        this._subscriptions.edit = this.provider.getObservable().edit.subscribe(this._onEditIn.bind(this));
        this._subscriptions.selection = this.provider.getObservable().selection.subscribe(this._onSelected.bind(this));
    }

    public ignoreMouseClick(event: MouseEvent) {
        this._ignore = true;
    }

    private _onEditIn(guid: string | undefined) {
        this._zone.run(() => {
            this._ng_edit = this.entity.getGUID() === guid;
            this._forceUpdate();
        });
    }

    private _onSelected(event: ISelectEvent) {
        this._zone.run(() => {
            this._ng_selected = event.guids.indexOf(this.entity.getGUID()) !== -1;
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
