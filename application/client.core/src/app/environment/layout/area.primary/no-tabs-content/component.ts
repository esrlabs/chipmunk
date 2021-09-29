import {
    Component,
    AfterViewInit,
    OnDestroy,
    ChangeDetectorRef,
    ViewContainerRef,
} from '@angular/core';
import FileOpenerService from '../../../services/service.file.opener';
import { ControllerComponentsDragDropFiles } from '../../../controller/components/controller.components.dragdrop.files';
import {
    NotificationsService,
    ENotificationType,
} from '../../../services.injectable/injectable.service.notifications';
import { Subscription } from 'rxjs';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import * as Toolkit from 'chipmunk.client.toolkit';
import { IPC } from '../../../services/service.electron.ipc';

@Component({
    selector: 'app-layout-area-no-tabs-content',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class LayoutPrimiryAreaNoTabsComponent implements AfterViewInit, OnDestroy {
    private _dragdrop: ControllerComponentsDragDropFiles | undefined;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('LayoutPrimiryAreaNoTabsComponent');

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _vcRef: ViewContainerRef,
        private _notifications: NotificationsService,
    ) {}

    ngAfterViewInit() {
        this._dragdrop = new ControllerComponentsDragDropFiles(this._vcRef.element.nativeElement);
        this._subscriptions.onFiles = this._dragdrop
            .getObservable()
            .onFiles.subscribe(this._onFilesDropped.bind(this));
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _onFilesDropped(files: File[]) {
        TabsSessionsService.add()
            .then(() => {
                FileOpenerService.open(FileOpenerService.getPathsFromFiles(files)).catch(
                    (error: Error) => {
                        this._notifications.add({
                            caption: 'Error opening file',
                            message: error.message,
                            options: {
                                type: ENotificationType.error,
                            },
                        });
                    },
                );
            })
            .catch((error: Error) => {
                this._logger.error(`Fail to open new tab due error: ${error.message}`);
            });
    }
}
