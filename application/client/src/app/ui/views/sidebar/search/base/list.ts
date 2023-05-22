import {
    Component,
    ChangeDetectorRef,
    AfterContentInit,
    Input,
    HostBinding,
    ChangeDetectionStrategy,
    OnDestroy,
} from '@angular/core';
import { Provider } from '../providers/definitions/provider';
import { Entity } from '../providers/definitions/entity';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';
import { Subscription } from 'rxjs';

export enum ListId {
    Filters = 'searchmanager-filters-list',
    Charts = 'searchmanager-charts-list',
    Disabled = 'searchmanager-disabled-list',
    Bin = 'searchmanager-bin-list',
}

@Component({
    selector: 'app-sidebar-entities-list-base',
    template: '',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Initial()
@Ilc()
export abstract class EntitiesList<P, T>
    extends ChangesDetector
    implements AfterContentInit, OnDestroy
{
    static HOST_DIRECTIVE = {
        directive: CdkDropList,
    };

    @Input() provider!: P & Provider<T>;

    @HostBinding('id') get id(): string {
        return this.getListId();
    }

    protected readonly subscriptions: Subscription[] = [];
    protected entries: Entity<T>[] = [];

    constructor(
        protected readonly cdRef: ChangeDetectorRef,
        protected readonly cdkDropListDir: CdkDropList,
    ) {
        super(cdRef);
        this.cdkDropListDir.connectedTo = [
            ListId.Filters,
            ListId.Charts,
            ListId.Disabled,
            ListId.Bin,
        ];
        this.cdkDropListDir.id = this.getListId();
        this.cdkDropListDir.lockAxis = 'y';
        this.subscriptions.push(
            ...[
                this.cdkDropListDir.dropped.subscribe((event: CdkDragDrop<any>) => {
                    const provider: P & Provider<T> = event.previousContainer.data;
                    if (provider.uuid === this.provider.uuid) {
                        this.provider.reorder({
                            prev: event.previousIndex,
                            curt: event.currentIndex,
                        });
                        return;
                    }
                    const dragged = provider.getEntityByIndex(event.previousIndex);
                    if (dragged === undefined) {
                        return;
                    }
                    this.provider.tryToInsertEntity(dragged, event.currentIndex);
                }),
                this.cdkDropListDir._dropListRef.beforeStarted.subscribe(() => {
                    this.cdkDropListDir.data = this.provider;
                    this.provider.events.get().dragging.emit();
                }),
            ],
        );
    }

    public ngOnDestroy(): void {
        this.subscriptions.forEach((s) => s.unsubscribe());
    }

    public ngAfterContentInit() {
        this.entries = this.provider.entities();
        this.env().subscriber.register(
            this.provider.subjects.get().change.subscribe(() => {
                this.entries = this.provider.entities();
                this.markChangesForCheck();
            }),
            this.provider.subjects.get().selection.subscribe(() => {
                this.markChangesForCheck();
            }),
        );
    }

    public onContexMenu(event: MouseEvent, entity: Entity<T>) {
        this.provider.select().context(event, entity);
    }

    protected abstract getListId(): ListId;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface EntitiesList<P, T> extends IlcInterface {}
