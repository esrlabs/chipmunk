import {
    Directive,
    ChangeDetectorRef,
    OnInit,
    OnDestroy,
    Input,
    HostBinding,
    HostListener,
} from '@angular/core';
import { Entity } from '../providers/definitions/entity';
import { Provider, ISelectEvent } from '../providers/definitions/provider';
import { CdkDragRelease } from '@angular/cdk/drag-drop';
import { MatDragDropResetFeatureDirective } from '@ui/env/directives/material.dragdrop';
import { DragAndDropService, DragableRequest } from '../draganddrop/service';
import { Subscriber } from '@platform/env/subscription';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Session } from '@service/session/session';

@Directive({
    selector: '[appSearchItem]',
})
export class SidebarAppSearchManagerItemDirective
    extends ChangesDetector
    implements OnInit, OnDestroy
{
    @Input() provider!: Provider<any>;
    @Input() entity!: Entity<any>;
    @Input() draganddrop!: DragAndDropService;
    @Input() session!: Session;

    public _ng_edit: boolean = false;
    public _ng_selected: boolean = false;
    public _ng_dragging: boolean = false;

    private _subscriber: Subscriber = new Subscriber();
    private _ignore: boolean = false;
    private _dragging: Entity<DragableRequest> | undefined;
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
        this.provider !== undefined && this.provider.select().set({ guid: this.entity.uuid() });
        this.detectChanges();
    }
    @HostListener('cdkDragStarted', ['entity']) DragStarted(entity: Entity<any>) {
        this.draganddrop.onDragStart(true, entity);
    }

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy() {
        this._subscriber.unsubscribe();
    }

    public ngOnInit() {
        this._subscriber.register(
            this.draganddrop.subjects.mouseOverBin.subscribe((status: boolean) => {
                this._overBin = status;
            }),
        );
        this._subscriber.register(
            this.draganddrop.subjects.remove.subscribe(() => {
                this._dragging = this.draganddrop.dragging;
                if (this._dragging) {
                    this.session.search.store().disabled().delete([this._dragging.uuid()]);
                }
            }),
        );
        this._subscriber.register(
            this.provider.subjects.edit.subscribe((guid: string | undefined) => {
                this._ng_edit = this.entity.uuid() === guid;
                this.detectChanges();
            }),
        );
        this._subscriber.register(
            this.provider.subjects.selection.subscribe((event: ISelectEvent) => {
                this._ng_selected = event.guids.indexOf(this.entity.uuid()) !== -1;
                if (!this._ng_selected) {
                    this._ng_edit = false;
                }
                this.detectChanges();
            }),
        );
        this._ng_selected = this.provider.select().get().indexOf(this.entity.uuid()) !== -1;
    }

    public ignoreMouseClick(event: MouseEvent) {
        this._ignore = true;
    }

    public setResetFeatureAccessorRef(ref: MatDragDropResetFeatureDirective) {
        this._resetFeatureAccessorRef = ref;
    }
}
