import { Component, OnDestroy, ChangeDetectorRef, AfterContentInit, Input } from '@angular/core';
import { RangeRequest } from '../../../../../controller/session/dependencies/search/dependencies/timeranges/controller.session.tab.search.ranges.request';
import { Subscription } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Provider } from '../../providers/provider';
import { Entity } from '../../providers/entity';
import {
    NotificationsService,
    ENotificationType,
} from '../../../../../services.injectable/injectable.service.notifications';
import { EntityData } from '../../providers/entity.data';
import SearchManagerService, { TRequest } from '../../service/service';

@Component({
    selector: 'app-sidebar-app-searchmanager-timerangehooks',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppSearchManagerTimeRangesComponent implements OnDestroy, AfterContentInit {
    @Input() provider!: Provider<RangeRequest>;

    public _ng_entries: Array<Entity<RangeRequest>> = [];
    public _ng_progress: boolean = false;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef, private _notifications: NotificationsService) {}

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._ng_entries = this.provider.get();
        this._subscriptions.change = this.provider
            .getObservable()
            .change.subscribe(this._onDataUpdate.bind(this));
    }

    public _ng_onItemDragged(event: CdkDragDrop<any>) {
        SearchManagerService.onDragStart(false);
        if (SearchManagerService.droppedOut) {
            return;
        }
        this.provider.itemDragged(event);
    }

    public _ng_onContexMenu(event: MouseEvent, entity: Entity<RangeRequest>) {
        this.provider.select().context(event, entity);
    }

    public _ng_onApply() {
        const session = this.provider.getSession();
        if (this._ng_progress || session === undefined) {
            return;
        }
        if (!session.getTimestamp().isDetected()) {
            return this._notifications.add({
                caption: 'No formats are found',
                message:
                    'At least one datetime format should be defined to use time ranges. Do you want to try to detect format automatically?',
                options: {
                    type: ENotificationType.accent,
                },
                buttons: [
                    {
                        caption: 'Detect',
                        handler: () => {
                            session
                                .getAPI()
                                .openToolbarApp(
                                    session.getAPI().getDefaultToolbarAppsIds().timemeasurement,
                                    false,
                                );
                        },
                    },
                ],
            });
        } else {
            this._ng_progress = true;
            // Note: we can import ProviderRanges (and get rid of "any" here), but it will give us circle-dependency
            (this.provider as any)
                .apply()
                .catch((err: Error) =>
                    this._notifications.add({
                        caption: 'Error',
                        message: err.message,
                        options: {
                            type: ENotificationType.warning,
                        },
                    }),
                )
                .finally(() => {
                    this._ng_progress = false;
                    this._forceUpdate();
                });
            this._forceUpdate();
        }
    }

    public _ng_viablePredicate(): () => boolean {
        return this.provider.isViable.bind(this);
    }

    public _ng_getDragAndDropData(): EntityData<RangeRequest> | undefined {
        return new EntityData<RangeRequest>({ entities: this._ng_entries });
    }

    private _onDataUpdate() {
        this._ng_entries = this.provider.get();
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
