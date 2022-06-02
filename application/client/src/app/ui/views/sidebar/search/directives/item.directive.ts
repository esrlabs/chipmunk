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
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { DisabledRequest } from '@service/session/dependencies/search/disabled/request';

@Directive({
    selector: '[appSearchItem]',
})
export class FilterItemDirective extends ChangesDetector implements OnInit, OnDestroy {
    @Input() provider!: Provider<any>;
    @Input() entity!: Entity<any>;

    public edit: boolean = false;
    public selected: boolean = false;
    public dragging: boolean = false;

    private _subscriber: Subscriber = new Subscriber();
    private _ignore: boolean = false;
    private _resetFeatureAccessorRef: MatDragDropResetFeatureDirective | undefined;
    private _overBin: boolean | undefined;

    @HostBinding('class.selected') get cssClassSelected() {
        return this.selected;
    }
    @HostBinding('class.edited') get cssClassEdited() {
        return this.edit;
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
        if (this.edit) {
            return;
        }
        this.provider !== undefined && this.provider.select().set({ guid: this.entity.uuid() });
        this.detectChanges();
    }
    @HostListener('cdkDragStarted', ['entity']) DragStarted(entity: Entity<any>) {
        this.provider.draganddrop.onDragStart(true, entity);
    }

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy() {
        this._subscriber.unsubscribe();
    }

    public ngOnInit() {
        this._subscriber.register(
            this.provider.draganddrop.subjects.mouseOverBin.subscribe((status: boolean) => {
                this._overBin = status;
            }),
        );
        this._subscriber.register(
            this.provider.draganddrop.subjects.remove.subscribe(() => {
                const dragging =
                    this.provider.draganddrop.dragging !== undefined
                        ? this.provider.draganddrop.dragging.extract()
                        : undefined;
                if (dragging === undefined) {
                    return;
                }
                if (dragging instanceof FilterRequest) {
                    this.provider.session.search.store().filters().delete([dragging.uuid()]);
                } else if (dragging instanceof DisabledRequest) {
                    this.provider.session.search.store().disabled().delete([dragging.uuid()]);
                }
            }),
        );
        this._subscriber.register(
            this.provider.subjects.edit.subscribe((guid: string | undefined) => {
                this.edit = this.entity.uuid() === guid;
                this.detectChanges();
            }),
        );
        this._subscriber.register(
            this.provider.subjects.selection.subscribe((event: ISelectEvent) => {
                this.selected = event.guids.indexOf(this.entity.uuid()) !== -1;
                if (!this.selected) {
                    this.edit = false;
                }
                this.detectChanges();
            }),
        );
        this.selected = this.provider.select().get().indexOf(this.entity.uuid()) !== -1;
    }

    public ignoreMouseClick(event: MouseEvent) {
        this._ignore = true;
    }

    public setResetFeatureAccessorRef(ref: MatDragDropResetFeatureDirective) {
        this._resetFeatureAccessorRef = ref;
    }
}
