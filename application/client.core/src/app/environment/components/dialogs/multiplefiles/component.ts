import { Component, ChangeDetectorRef, Input, AfterViewInit, ViewContainerRef, OnDestroy } from '@angular/core';
import ServiceElectronIpc, { IPCMessages } from '../../../services/service.electron.ipc';
import { FilesList } from '../../../controller/controller.file.storage';
import { Subscription } from 'rxjs';
import { ControllerComponentsDragDropFiles } from '../../../controller/components/controller.components.dragdrop.files';
import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-views-dialogs-multiplefilescation-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DialogsMultipleFilesActionComponent implements AfterViewInit, OnDestroy {

    @Input() files: IPCMessages.IFile[] = [];
    @Input() fileList: FilesList;

    private _dragdrop: ControllerComponentsDragDropFiles | undefined;
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _logger: Toolkit.Logger = new Toolkit.Logger('MultipleFilesDialog');
    private _destroyed = false;

    constructor(private _cdRef: ChangeDetectorRef, private _vcRef: ViewContainerRef, ) {
    }

    ngAfterViewInit() {
        this._dragdrop = new ControllerComponentsDragDropFiles(this._vcRef.element.nativeElement);
        this._subscriptions.onFiles = this._dragdrop.getObservable().onFiles.subscribe(this._onFilesDropped.bind(this));
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

    private _getUniqueFiles(files: IPCMessages.IFile[]): IPCMessages.IFile[] {
        return files.filter((file: IPCMessages.IFile) => {
            return this.files.findIndex((f: IPCMessages.IFile) => f.path === file.path) === -1;
        });
    }

    private _onFilesDropped(files: IPCMessages.IFile[]) {
        if (files.length === 0) {
            return;
        }
        ServiceElectronIpc.request(new IPCMessages.FileListRequest({
            files: files.map((file: IPCMessages.IFile) => file.path),
        }), IPCMessages.FileListResponse).then((checkResponse: IPCMessages.FileListResponse) => {
            if (checkResponse.error !== undefined) {
                this._logger.error(`Failed to check paths due error: ${checkResponse.error}`);
                return;
            }
            this.files = this.files.concat(this._getUniqueFiles(checkResponse.files));
            this._forceUpdate();
        }).catch((error: Error) => {
            this._logger.error(`Cannot continue with opening file, because fail to prepare session due error: ${error.message}`);
        });
    }

    public _ng_onChange(event: any, fileName: IPCMessages.IFile) {
        fileName.checked = event.checked;
        this.fileList.setFiles(this.files.filter((file: IPCMessages.IFile) => file.checked === true ));
    }

}
