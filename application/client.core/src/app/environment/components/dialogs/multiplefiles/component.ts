import {
    Component,
    ChangeDetectorRef,
    Input,
    AfterViewInit,
    ViewContainerRef,
    OnDestroy,
} from '@angular/core';
import ServiceElectronIpc, { IPC } from '../../../services/service.electron.ipc';
import { FilesList } from '../../../controller/controller.file.storage';
import { Observable, Subscription } from 'rxjs';
import { ControllerComponentsDragDropFiles } from '../../../controller/components/controller.components.dragdrop.files';
import * as Toolkit from 'chipmunk.client.toolkit';
import ContextMenuService, { IMenuItem } from '../../../services/standalone/service.contextmenu';
import FileOpenerService from '../../../services/service.file.opener';

@Component({
    selector: 'app-views-dialogs-multiplefilescation-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class DialogsMultipleFilesActionComponent implements AfterViewInit, OnDestroy {
    @Input() fileList!: FilesList;

    private _dragdrop: ControllerComponentsDragDropFiles | undefined;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('MultipleFilesDialog');
    private _destroyed = false;

    constructor(private _cdRef: ChangeDetectorRef, private _vcRef: ViewContainerRef) {}

    ngAfterViewInit() {
        this._dragdrop = new ControllerComponentsDragDropFiles(this._vcRef.element.nativeElement);
        this._subscriptions.onFiles = this._dragdrop
            .getObservable()
            .onFiles.subscribe(this._onFilesDropped.bind(this));
    }

    ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

    private _getUniqueFiles(files: IPC.IFile[]): IPC.IFile[] {
        return files.filter((file: IPC.IFile) => {
            return (
                this.fileList.getFiles().findIndex((f: IPC.IFile) => f.path === file.path) === -1
            );
        });
    }

    public _ng_onChange(event: any, fileName: IPC.IFile) {
        fileName.checked = event.checked;
    }

    private _onFilesDropped(files: File[]) {
        if (files.length === 0) {
            return;
        }
        ServiceElectronIpc.request<IPC.FileListResponse>(
            new IPC.FileListRequest({
                files: FileOpenerService.getPathsFromFiles(files),
            }),
            IPC.FileListResponse,
        )
            .then((checkResponse) => {
                if (checkResponse.error !== undefined) {
                    this._logger.error(`Failed to check paths due error: ${checkResponse.error}`);
                    return;
                }
                this.fileList.setFiles(
                    this.fileList.getFiles().concat(this._getUniqueFiles(checkResponse.files)),
                );
                this._forceUpdate();
            })
            .catch((error: Error) => {
                this._logger.error(
                    `Cannot continue with opening file, because fail to prepare session due error: ${error.message}`,
                );
            });
    }

    private _selectAll() {
        this.fileList.setFiles(
            this.fileList.getFiles().map((file: IPC.IFile) => {
                if (!file.disabled) {
                    file.checked = true;
                }
                return file;
            }),
        );
    }

    private _deselectAll() {
        this.fileList.setFiles(
            this.fileList.getFiles().map((file: IPC.IFile) => {
                if (!file.disabled) {
                    file.checked = false;
                }
                return file;
            }),
        );
    }

    private _reverseSelectAll() {
        this.fileList.setFiles(
            this.fileList.getFiles().map((file: IPC.IFile) => {
                if (!file.disabled) {
                    file.checked = !file.checked;
                }
                return file;
            }),
        );
    }

    public _ng_onContexMenu(event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption: 'Select all',
                handler: this._selectAll.bind(this),
            },
            {
                caption: 'Deselect all',
                handler: this._deselectAll.bind(this),
            },
            {
                caption: 'Reverse select all',
                handler: this._reverseSelectAll.bind(this),
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
    }
}
