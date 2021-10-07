// tslint:disable: member-ordering

import {
    Component,
    OnDestroy,
    Input,
    ChangeDetectorRef,
    HostListener,
    AfterContentInit,
    AfterViewInit,
    ViewContainerRef,
} from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { ControllerComponentsDragDropFiles } from '../../../controller/components/controller.components.dragdrop.files';
import { Session } from '../../../controller/session/session';
import {
    NotificationsService,
    ENotificationType,
} from '../../../services.injectable/injectable.service.notifications';
import { IServices } from '../../../services/shared.services.sidebar';
import {
    ControllerFileMergeSession,
    IMergeFile,
    EViewMode,
} from '../../../controller/controller.file.merge.session';
import { IMenuItem } from '../../../services/standalone/service.contextmenu';

import FileOpenerService from '../../../services/service.file.opener';
import EventsSessionService from '../../../services/standalone/service.events.session';
import ContextMenuService from '../../../services/standalone/service.contextmenu';
import ElectronEnvService from '../../../services/service.electron.env';

import * as Toolkit from 'chipmunk.client.toolkit';

enum EState {
    merge = 'merge',
    discover = 'discover',
    ready = 'ready',
}

@Component({
    selector: 'app-sidebar-app-files',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppMergeFilesComponent implements OnDestroy, AfterContentInit, AfterViewInit {
    public static StateKey = 'side-bar-merge-view';

    @Input() public services!: IServices;
    @Input() public onBeforeTabRemove!: Subject<void>;
    @Input() public close!: () => void;

    public _ng_controller!: ControllerFileMergeSession;
    public _ng_select: Subject<IMergeFile | undefined> = new Subject<IMergeFile | undefined>();
    public _ng_selected: IMergeFile | undefined;
    public _ng_state: EState = EState.ready;
    public _ng_viewMode: EViewMode = EViewMode.max;
    public _ng_timeLineVisibility: boolean = true;

    @HostListener('contextmenu', ['$event']) onContextMenu(event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption:
                    this._ng_viewMode === EViewMode.max ? 'Show Time Range' : 'Show Time Format',
                handler: () => {
                    this._ng_viewMode =
                        this._ng_viewMode === EViewMode.max ? EViewMode.min : EViewMode.max;
                    this._forceUpdate();
                },
            },
            {
                /* delimiter */
            },
            {
                caption: this._ng_timeLineVisibility ? 'Hide Timeline' : 'Show Timeline',
                handler: () => {
                    this._ng_timeLineVisibility = !this._ng_timeLineVisibility;
                    this._forceUpdate();
                },
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    private _dragdrop: ControllerComponentsDragDropFiles | undefined;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppMergeFilesComponent');
    private _destroyed: boolean = false;

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _vcRef: ViewContainerRef,
        private _notifications: NotificationsService,
    ) {}

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        this._subscriptions.onBeforeTabRemove = this.onBeforeTabRemove
            .asObservable()
            .subscribe(this._onBeforeTabRemove.bind(this));
        this._subscriptions.selected = this._ng_select
            .asObservable()
            .subscribe(this._onSelected.bind(this));
        this._dragdrop = new ControllerComponentsDragDropFiles(this._vcRef.element.nativeElement);
        this._subscriptions.onFiles = this._dragdrop
            .getObservable()
            .onFiles.subscribe(this._onFilesDropped.bind(this));
        const controller = this.services.MergeFilesService.getController();
        if (controller === undefined) {
            throw new Error(this._logger.error(`Fail to get merge files controller`));
        }
        this._ng_controller = controller;
    }

    public ngAfterViewInit() {
        // this._subscriptions.onBeforeTabRemove = this.onBeforeTabRemove.asObservable().subscribe(this._onBeforeTabRemove.bind(this));
    }

    public _ng_onAdd() {
        if (this._ng_controller === undefined) {
            return;
        }
        ElectronEnvService.get()
            .showOpenDialog({
                properties: ['openFile', 'showHiddenFiles', 'multiSelections'],
            })
            .then((result: { filePaths: string[] }) => {
                if (!(result.filePaths instanceof Array)) {
                    return;
                }
                this._ng_state = EState.discover;
                this._ng_controller !== undefined &&
                    this._ng_controller
                        .add(result.filePaths)
                        .catch((error: Error) => {
                            this._notifications.add({
                                caption: 'Merge',
                                message: `Fail to add files due error: ${error.message}`,
                                options: {
                                    type: ENotificationType.error,
                                },
                            });
                        })
                        .finally(() => {
                            this._ng_state = EState.ready;
                            this._forceUpdate();
                        });
                this._forceUpdate();
            })
            .catch((openErr: Error) => {
                this._logger.error(`Fail add file to be merged due error: ${openErr.message}`);
            });
    }

    public _ng_onMerge() {
        if (this._ng_controller === undefined) {
            return;
        }
        this._ng_state = EState.merge;
        this._ng_controller
            .merge()
            .then(() => {
                this.services.MergeFilesService.closeSidebarView();
            })
            .catch((error: Error) => {
                this._notifications.add({
                    caption: 'Merge',
                    message: `Fail to merge files due error: ${error.message}`,
                    options: {
                        type: ENotificationType.error,
                    },
                });
            })
            .finally(() => {
                this._ng_state = EState.ready;
                this._forceUpdate();
            });
        this._forceUpdate();
    }

    public _ng_disabled(): boolean {
        return this._ng_state !== EState.ready;
    }

    private _onSelected(file: IMergeFile | undefined) {
        this._ng_selected = file;
        this._forceUpdate();
    }

    private _onFilesDropped(files: File[]) {
        if (this._ng_controller === undefined) {
            return;
        }
        this._ng_controller.add(FileOpenerService.getPathsFromFiles(files));
    }

    private _onSessionChange(session: Session | undefined) {
        if (session !== undefined) {
            const controller = this.services.MergeFilesService.getController(session.getGuid());
            if (controller === undefined) {
                this._logger.error(`Fail to get merge files controller`);
                return;
            }
            this._ng_controller = controller;
        }
        this._forceUpdate();
    }

    private _onBeforeTabRemove() {
        if (this._ng_controller === undefined) {
            return;
        }
        this._ng_controller.drop();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
