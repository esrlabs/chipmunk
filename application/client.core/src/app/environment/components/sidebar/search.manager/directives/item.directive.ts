import {
    Directive,
    ChangeDetectorRef,
    OnInit,
    OnDestroy,
    Input,
    HostBinding,
    HostListener,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { Entity } from '../providers/entity';
import { Provider, ISelectEvent } from '../providers/provider';
import { CdkDragRelease } from '@angular/cdk/drag-drop';
import { MatDragDropResetFeatureDirective } from '../../../../directives/material.dragdrop.directive';

import SearchManagerService, { TRequest } from '../service/service';

@Directive({
    selector: '[appSidebarSearchManagerItem]',
})
export class SidebarAppSearchManagerItemDirective implements OnInit, OnDestroy {
    @Input() provider: Provider<any> | undefined;
    @Input() entity!: Entity<any>;

    public _ng_edit: boolean = false;
    public _ng_selected: boolean = false;
    public _ng_dragging: boolean = false;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;
    private _ignore: boolean = false;
    private _dragging: Entity<TRequest> | undefined;
    private _resetFeatureAccessorRef: MatDragDropResetFeatureDirective | undefined;
    private _overBin: boolean | undefined;

    @HostBinding('class.selected') get cssClassSelected() {
        return this._ng_selected;
    }
    @HostBinding('class.edited') get cssClassEdited() {
        return this._ng_edit;
    }
    @HostListener('cdkDragReleased', ['$event']) _cdkDragReleased(event: CdkDragRelease) {
        if (this._resetFeatureAccessorRef === undefined) {
            return;
        }
        if (this._overBin) {
            return;
        }
        this._resetFeatureAccessorRef.reset(event);
    }
    @HostListener('click', ['$event']) onClick(event: MouseEvent) {
        if (this._ignore) {
            this._ignore = false;
            return;
        }
        if (this._ng_edit) {
            return;
        }
        this.provider !== undefined && this.provider.select().set({ guid: this.entity.getGUID() });
        this._forceUpdate();
    }
    @HostListener('cdkDragStarted', ['entity']) DragStarted(entity: Entity<any>) {
        SearchManagerService.onDragStart(true, entity);
    }

    constructor(private _cdRef: ChangeDetectorRef) {}

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngOnInit() {
        this._subscriptions.overBin = SearchManagerService.observable.mouseOverBin.subscribe(
            this._onMouseOverBin.bind(this),
        );
        this._subscriptions.remove = SearchManagerService.observable.remove.subscribe(
            this._onRemove.bind(this),
        );
        if (this.provider !== undefined) {
            this._subscriptions.edit = this.provider
                .getObservable()
                .edit.subscribe(this._onEditIn.bind(this));
            this._subscriptions.selection = this.provider
                .getObservable()
                .selection.subscribe(this._onSelected.bind(this));
        }
        if (this.provider !== undefined && this.entity !== undefined) {
            this._ng_selected = this.provider.select().get().indexOf(this.entity.getGUID()) !== -1;
        }
    }

    public ignoreMouseClick(event: MouseEvent) {
        this._ignore = true;
    }

    public setResetFeatureAccessorRef(ref: MatDragDropResetFeatureDirective) {
        this._resetFeatureAccessorRef = ref;
    }

    private _onMouseOverBin(status: boolean) {
        this._overBin = status;
    }

    private _onEditIn(guid: string | undefined) {
        this._ng_edit = this.entity.getGUID() === guid;
        this._forceUpdate();
    }

    private _onSelected(event: ISelectEvent) {
        this._ng_selected = event.guids.indexOf(this.entity.getGUID()) !== -1;
        if (!this._ng_selected) {
            this._ng_edit = false;
        }
        this._forceUpdate();
    }

    private _onRemove() {
        if (this.provider === undefined) {
            return;
        }
        const session = this.provider.getSession();
        if (session === undefined) {
            return;
        }
        this._dragging = SearchManagerService.dragging;
        if (this._dragging) {
            this._dragging.getEntity().remove(session);
        }
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
