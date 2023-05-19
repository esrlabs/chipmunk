import {
    Component,
    ChangeDetectorRef,
    OnInit,
    Input,
    HostBinding,
    HostListener,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Provider, ISelectEvent } from '../providers/definitions/provider';
import { Entity } from '../providers/definitions/entity';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { DisabledRequest } from '@service/session/dependencies/search/disabled/request';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { CdkDrag, CdkDragRelease } from '@angular/cdk/drag-drop';
import { MatDragDropResetFeatureDirective } from '@ui/env/directives/material.dragdrop';

export enum ListId {
    Filters = 'searchmanager-filters-list',
    Charts = 'searchmanager-charts-list',
    Disabled = 'searchmanager-disabled-list',
    Bin = 'searchmanager-bin-list',
}

@Component({
    selector: 'app-sidebar-entity-item-base',
    template: '',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Initial()
@Ilc()
export abstract class EntityItem<P, T> extends ChangesDetector implements OnInit {
    static HOST_DIRECTIVES = [
        {
            directive: CdkDrag,
        },
    ];

    @Input() provider!: P & Provider<T>;
    @Input() entity!: Entity<T>;

    public edit: boolean = false;
    public selected: boolean = false;
    public dragging: boolean = false;

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
    @HostListener('click') onClick() {
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

    public ngOnInit() {
        this.env().subscriber.register(
            this.provider.draganddrop.subjects.mouseOverBin.subscribe((status: boolean) => {
                this._overBin = status;
            }),
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
                } else if (dragging instanceof ChartRequest) {
                    this.provider.session.search.store().charts().delete([dragging.uuid()]);
                }
            }),
            this.provider.subjects.edit.subscribe((guid: string | undefined) => {
                this.edit = this.entity.uuid() === guid;
                this.detectChanges();
            }),
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

    public ignoreMouseClick() {
        this._ignore = true;
    }

    public setResetFeatureAccessorRef(ref: MatDragDropResetFeatureDirective) {
        this._resetFeatureAccessorRef = ref;
    }
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface EntityItem<P, T> extends IlcInterface {}
