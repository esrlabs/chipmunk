import { Component, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewContainerRef } from '@angular/core';
import FileOpenerService, { IFile } from '../../../services/service.file.opener';
import { ControllerComponentsDragDropFiles } from '../../../controller/components/controller.components.dragdrop.files';
import { Subscription } from 'rxjs';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import * as Toolkit from 'logviewer.client.toolkit';

@Component({
    selector: 'app-layout-area-no-tabs-content',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutPrimiryAreaNoTabsComponent implements AfterViewInit, OnDestroy {

    private _dragdrop: ControllerComponentsDragDropFiles | undefined;
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _logger: Toolkit.Logger = new Toolkit.Logger('LayoutPrimiryAreaNoTabsComponent');

    constructor(private _cdRef: ChangeDetectorRef, private _vcRef: ViewContainerRef) {

    }

    ngAfterViewInit() {
        this._dragdrop = new ControllerComponentsDragDropFiles(this._vcRef.element.nativeElement);
        this._subscriptions.onFiles = this._dragdrop.getObservable().onFiles.subscribe(this._onFilesDropped.bind(this));
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _onFilesDropped(files: IFile[]) {
        TabsSessionsService.add().then(() => {
            FileOpenerService.open(files);
        }).catch((error: Error) => {
            this._logger.error(`Fail to open new tab due error: ${error.message}`);
        });
    }

}
