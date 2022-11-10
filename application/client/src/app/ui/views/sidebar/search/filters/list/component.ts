import {
    Component,
    ChangeDetectorRef,
    AfterContentInit,
    Input,
} from '@angular/core';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ProviderFilters } from '../provider';
import { Entity } from '../../providers/definitions/entity';
import { EntityData } from '../../providers/definitions/entity.data';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-sidebar-filters-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class FiltersList extends ChangesDetector implements AfterContentInit {
    @Input() provider!: ProviderFilters;

    public entries: Array<Entity<FilterRequest>> = [];

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit() {
        this.entries = this.provider.entities();
        this.env().subscriber.register(
            this.provider.subjects.change.subscribe(() => {
                this.entries = this.provider.entities();
                this.detectChanges();
            }),
        );
    }

    public _ng_onItemDragged(event: CdkDragDrop<any>) {
        this.provider.draganddrop.onDragStart(false);
        if (this.provider.draganddrop.droppedOut) {
            return;
        }
        this.provider.dropped(event);
    }

    public _ng_onContexMenu(event: MouseEvent, entity: Entity<FilterRequest>) {
        this.provider.select().context(event, entity);
    }

    public _ng_viablePredicate(): () => boolean {
        return this.provider.isVisable.bind(this);
    }

    public _ng_getDragAndDropData(): EntityData<FilterRequest> | undefined {
        return new EntityData<FilterRequest>({ entities: this.entries });
    }
}
export interface FiltersList extends IlcInterface {}
