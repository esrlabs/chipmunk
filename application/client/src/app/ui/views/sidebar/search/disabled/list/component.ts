import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    Input,
    ViewChild,
} from '@angular/core';
import { DisabledRequest } from '@service/session/dependencies/search/disabled/request';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ProviderDisabled } from '../provider';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Entity } from '../../providers/definitions/entity';
import { EntityData } from '../../providers/definitions/entity.data';
import { DragAndDropService } from '../../draganddrop/service';
import { Session } from '@service/session/session';

@Component({
    selector: 'app-sidebar-disabled-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class DisabledList extends ChangesDetector implements AfterContentInit {
    @Input() provider!: ProviderDisabled;

    public entries: Array<Entity<DisabledRequest>> = [];

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

    public _ng_onContexMenu(event: MouseEvent, entity: Entity<DisabledRequest>) {
        this.provider.select().context(event, entity);
    }

    public _ng_onDoubleClick(event: MouseEvent, entity: Entity<DisabledRequest>) {
        this.provider.select().doubleclick(event, entity);
    }

    public _ng_getDragAndDropData(): EntityData<DisabledRequest> | undefined {
        return new EntityData({ disabled: this.entries });
    }
}
export interface DisabledList extends IlcInterface {}
