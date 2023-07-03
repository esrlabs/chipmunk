import {
    Component,
    ViewChild,
    ChangeDetectorRef,
    AfterContentInit,
    Input,
    ViewEncapsulation,
    AfterViewInit,
    OnDestroy,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { FileHolder } from '../file.holder';
import { FileType } from '@platform/types/observe/types/file';
import { Subscription } from 'rxjs';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { State } from '../state';

export interface IEvent {
    type: EEventType;
    files: FileHolder[];
}

export enum EEventType {
    update = 'update',
    select = 'select',
    open = 'open',
    sort = 'sort',
}

export const COLUMNS = {
    color: 'color',
    type: 'type',
    name: 'name',
    path: 'path',
    size: 'size',
    modificationDate: 'modificationDate',
};

@Component({
    selector: 'app-tabs-source-multiplefiles-structure',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Ilc()
export class TabSourceMultipleFilesStructure
    extends ChangesDetector
    implements AfterContentInit, AfterViewInit, OnDestroy
{
    @Input() state!: State;

    @ViewChild(MatSort) sort!: MatSort;

    public data!: MatTableDataSource<FileHolder>;
    public readonly columns: string[] = [
        COLUMNS.color,
        COLUMNS.type,
        COLUMNS.name,
        COLUMNS.path,
        COLUMNS.size,
        COLUMNS.modificationDate,
    ];

    private _sortConfig: Sort = { active: '', direction: '' };
    private _dataConnect!: Subscription;
    private _sortChange!: Subscription;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit() {
        this.data = new MatTableDataSource<FileHolder>(this.state.files);
        this.env().subscriber.register(
            this.state.filesUpdate.subscribe(this._onFilesUpdate.bind(this)),
        );
        this._subscribe();
    }

    public ngAfterViewInit() {
        this.data.sort = this.sort;
        this.sort.sort({
            id: this.state.sortConfig.active,
            start: this.state.sortConfig.direction,
            disableClear: false,
        });
        this._sortChange = this.sort.sortChange.subscribe((sortConfig: Sort) => {
            this._sortConfig = sortConfig;
        });
    }

    public ngOnDestroy() {
        this.state.sortConfig = this._sortConfig;
        this._dataConnect && this._dataConnect.unsubscribe();
        this._sortChange && this._sortChange.unsubscribe();
    }

    public ngOnDropListDropped(event: CdkDragDrop<FileHolder[]>) {
        this.sort.sort({ id: '', start: '', disableClear: false });
        this._dataConnect && this._dataConnect.unsubscribe();
        moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
        this.data = new MatTableDataSource<FileHolder>(event.container.data);
        this._subscribe();
        this.data.sort = this.sort;
        this.state.event({ type: EEventType.sort, files: event.container.data });
    }

    public ngOnRowSelect(file: FileHolder) {
        file.reverseSelect();
        this.state.event({ type: EEventType.select, files: [] });
    }

    public ngContextMenu(event: MouseEvent, file?: FileHolder) {
        event.stopImmediatePropagation();
        const items = [];
        if (file !== undefined) {
            items.push({
                caption: 'Open File',
                handler: () => {
                    this.state.event({ type: EEventType.open, files: [file] });
                },
                disabled: file.type === FileType.Binary,
            });
        }
        items.push(
            {
                caption: 'Open Selected',
                handler: () => {
                    this.state.event({
                        type: EEventType.open,
                        files: this.data.data.filter((file: FileHolder) => file.selected),
                    });
                },
            },
            {
                /* Delimiter */
            },
        );
        if (file !== undefined) {
            items.push(
                {
                    caption: file.selected ? 'Unselect' : 'Select',
                    handler: () => {
                        file.selected ? file.unselect() : file.select();
                        this.state.event({ type: EEventType.select, files: [] });
                    },
                },
                {
                    caption: `Select Only [${file.type}]`,
                    handler: () => {
                        this.data.data.forEach((f: FileHolder) =>
                            f.type === file.type ? f.select() : f.unselect(),
                        );
                        this.state.event({ type: EEventType.select, files: [] });
                    },
                },
                {
                    caption: `Unselect Only [${file.type}]`,
                    handler: () => {
                        this.data.data.forEach((f: FileHolder) => {
                            if (f.type === file.type) {
                                f.unselect();
                            }
                        });
                        this.state.event({ type: EEventType.select, files: [] });
                    },
                },
                {
                    /* Delimiter */
                },
            );
        }
        items.push(
            {
                caption: 'Select All',
                handler: () => {
                    this.data.data.forEach((f: FileHolder) => f.select());
                    this.state.event({ type: EEventType.select, files: [] });
                },
            },
            {
                caption: 'Unselect All',
                handler: () => {
                    this.data.data.forEach((f: FileHolder) => f.unselect());
                    this.state.event({ type: EEventType.select, files: [] });
                },
            },
            {
                caption: 'Reverse Select All',
                handler: () => {
                    this.data.data.forEach((f: FileHolder) => f.reverseSelect());
                    this.state.event({ type: EEventType.select, files: [] });
                },
            },
            {
                /* Delimiter */
            },
        );
        if (file !== undefined) {
            items.push(
                {
                    caption: 'Remove',
                    handler: () => {
                        this.data.data = this.data.data.filter((f: FileHolder) => f !== file);
                        this.state.event({ type: EEventType.update, files: [file] });
                    },
                },
                {
                    caption: `Remove All [Non-${file.type}]`,
                    handler: () => {
                        const removed: FileHolder[] = [];
                        const kept: FileHolder[] = [];
                        this.data.data.forEach((f: FileHolder) =>
                            f.type === file.type ? kept.push(f) : removed.push(f),
                        );
                        this.data.data = kept;
                        removed.length > 0 &&
                            this.state.event({ type: EEventType.update, files: removed });
                    },
                },
            );
        }
        items.push(
            {
                caption: 'Remove All Empty',
                handler: () => {
                    const removed: FileHolder[] = [];
                    const kept: FileHolder[] = [];
                    this.data.data.forEach((f: FileHolder) =>
                        f.sizeInByte() === 0 ? removed.push(f) : kept.push(f),
                    );
                    this.data.data = kept;
                    removed.length > 0 &&
                        this.state.event({ type: EEventType.update, files: removed });
                },
            },
            {
                caption: 'Remove All',
                handler: () => {
                    this.data.data = [];
                    this.state.event({ type: EEventType.update, files: [] });
                },
            },
        );
        this.ilc().emitter.ui.contextmenu.open({
            items: [...items],
            x: event.x,
            y: event.y,
        });
    }

    private _onFilesUpdate(files: FileHolder[]) {
        this.data.data = files;
    }

    private _subscribe() {
        if (this.data) {
            this._dataConnect = this.data.connect().subscribe((files: FileHolder[]) => {
                if (
                    files.length === this.data.data.length &&
                    files.every((file, index) => file === this.data.data[index])
                ) {
                    return;
                }
                this.data.data = files;
                this.state.event({ type: EEventType.sort, files: files });
            });
        }
    }
}
export interface TabSourceMultipleFilesStructure extends IlcInterface {}
