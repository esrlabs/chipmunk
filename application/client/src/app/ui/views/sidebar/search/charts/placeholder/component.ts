import { Component, OnDestroy, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ProviderCharts } from '../provider';
import { DragAndDropService } from '../../draganddrop/service';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';

@Component({
    selector: 'app-sidebar-charts-placeholder',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ChartsPlaceholder implements OnDestroy {
    @Input() provider!: ProviderCharts;
    @Input() draganddrop!: DragAndDropService;

    public _ng_empty = 'No charts are stored';

    private _subscriptions: { [key: string]: Subscription } = {};

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onItemDragged(event: CdkDragDrop<any>) {
        this.draganddrop.onDragStart(false);
        if (this.draganddrop.droppedOut) {
            return;
        }
        this.provider.dropped(event);
    }
}
export interface ChartsPlaceholder extends IlcInterface {}
