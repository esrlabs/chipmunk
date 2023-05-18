import {
    Component,
    ChangeDetectorRef,
    AfterContentInit,
    Input,
    ChangeDetectionStrategy,
} from '@angular/core';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ProviderCharts } from '../provider';
import { Entity } from '../../providers/definitions/entity';
import { EntityData } from '../../providers/definitions/entity.data';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-sidebar-charts-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Initial()
@Ilc()
export class ChartsList extends ChangesDetector implements AfterContentInit {
    @Input() provider!: ProviderCharts;

    public entries: Array<Entity<ChartRequest>> = [];

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

    public _ng_onContexMenu(event: MouseEvent, entity: Entity<ChartRequest>) {
        this.provider.select().context(event, entity);
    }

    public _ng_viablePredicate(): () => boolean {
        return this.provider.isVisable.bind(this);
    }

    public _ng_getDragAndDropData(): EntityData<ChartRequest> | undefined {
        return new EntityData<ChartRequest>({ entities: this.entries });
    }
}
export interface ChartsList extends IlcInterface {}
