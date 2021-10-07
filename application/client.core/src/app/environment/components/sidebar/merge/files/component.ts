// tslint:disable:member-ordering

import * as Toolkit from 'chipmunk.client.toolkit';

import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    Input,
    ViewChild,
    AfterContentInit,
    AfterViewInit,
    OnChanges,
    SimpleChanges,
    ViewContainerRef,
} from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';
import {
    ControllerFileMergeSession,
    IMergeFile,
    EViewMode,
} from '../../../../controller/controller.file.merge.session';

@Component({
    selector: 'app-sidebar-app-files-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppMergeFilesListComponent
    implements OnDestroy, AfterContentInit, AfterViewInit, OnChanges
{
    @Input() public controller!: ControllerFileMergeSession;
    @Input() public select!: Subject<IMergeFile | undefined>;
    @Input() public viewMode!: EViewMode;
    @Input() public timeLineVisibility!: boolean;

    public _ng_files: IMergeFile[] = [];
    public _ng_width: number = 0;

    private _lastSelectedFilePath: string | undefined;
    private _resizeObserver!: ResizeObserver;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _vcRef: ViewContainerRef, private _cdRef: ChangeDetectorRef) {}

    public ngAfterContentInit() {}

    public ngAfterViewInit() {
        this._subscribe(this.controller);
        this._ng_files = this.controller.getFiles();
        this._resizeObserver = new ResizeObserver(this._updateWidth.bind(this));
        this._resizeObserver.observe(this._vcRef.element.nativeElement);
        this._updateWidth();
    }

    public ngOnChanges(changes: SimpleChanges) {
        if (changes.controller !== undefined) {
            this._subscribe(changes.controller.currentValue);
        }
        if (
            (changes.viewMode !== undefined &&
                changes.viewMode.previousValue !== changes.viewMode.currentValue) ||
            (changes.timeLineVisibility !== undefined &&
                changes.timeLineVisibility.previousValue !==
                    changes.timeLineVisibility.currentValue)
        ) {
            this._forceUpdate();
        }
    }

    public ngOnDestroy() {
        this._destroyed = true;
        this._resizeObserver.disconnect();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onSelect(file: IMergeFile) {
        if (file.info === undefined || file.path === this._lastSelectedFilePath) {
            this._lastSelectedFilePath = undefined;
            this.select.next(undefined);
        } else if (file.info !== undefined) {
            this._lastSelectedFilePath = file.path;
            this.select.next(file);
        }
    }

    private _updateWidth() {
        if (this._vcRef === undefined || this._vcRef.element.nativeElement === undefined) {
            return;
        }
        this._ng_width = (
            this._vcRef.element.nativeElement as HTMLElement
        ).getBoundingClientRect().width;
        this._forceUpdate();
    }

    private _subscribe(controller: ControllerFileMergeSession | undefined) {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        if (controller === undefined) {
            return;
        }
        this._subscriptions.FilesUpdated = controller
            .getObservable()
            .FilesUpdated.subscribe(this._onFilesUpdated.bind(this));
        this._subscriptions.FileUpdated = controller
            .getObservable()
            .FileUpdated.subscribe(this._onFileUpdated.bind(this));
    }

    private _onFilesUpdated(files: IMergeFile[]) {
        this._ng_files = files;
        if (this._ng_files.length === 0) {
            this.select.next(undefined);
        }
        this._forceUpdate();
    }

    private _onFileUpdated(file: IMergeFile) {
        this._ng_files = this._ng_files.map((_file: IMergeFile) => {
            return _file.path === file.path ? file : _file;
        });
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
