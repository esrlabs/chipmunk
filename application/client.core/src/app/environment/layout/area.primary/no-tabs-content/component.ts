import { Component, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewContainerRef } from '@angular/core';
import FileOpenerService from '../../../services/service.file.opener';
import { ControllerComponentsDragDropFiles } from '../../../controller/components/controller.components.dragdrop.files';
import { Subscription } from 'rxjs';
import TabsSessionsService from '../../../services/service.sessions.tabs';

@Component({
    selector: 'app-layout-area-no-tabs-content',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutPrimiryAreaNoTabsComponent implements AfterViewInit, OnDestroy {

    private _dragdrop: ControllerComponentsDragDropFiles | undefined;
    private _subscriptions: { [key: string]: Subscription | undefined } = { };

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

    private _onFilesDropped(files: File[]) {
        TabsSessionsService.add();
        FileOpenerService.open(files);
    }

}
