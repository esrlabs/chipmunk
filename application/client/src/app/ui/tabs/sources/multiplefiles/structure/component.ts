import {
    Component,
    ViewChild,
    ChangeDetectorRef,
    AfterContentInit,
    Input,
    ViewEncapsulation,
    Output,
    EventEmitter,
    AfterViewInit,
    OnDestroy,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { MatSort } from '@angular/material/sort';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { FileHolder } from '../file.holder';
import { Subject } from '@platform/env/subscription';
import { FileType } from '@platform/types/files';
import { Subscription } from 'rxjs';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

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
    @Input() files!: FileHolder[];
    @Input() filesUpdate!: Subject<FileHolder[]>;

    @Output() event: EventEmitter<IEvent> = new EventEmitter();

    @ViewChild(MatSort) sort!: MatSort;
    @ViewChild(MatTable) table!: MatTable<any>;

    public data!: MatTableDataSource<FileHolder>;
    public readonly columns: string[] = [
        COLUMNS.type,
        COLUMNS.name,
        COLUMNS.path,
        COLUMNS.size,
        COLUMNS.modificationDate,
    ];

    private _subscription!: Subscription;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit() {
        this.data = new MatTableDataSource<FileHolder>(this.files);
        this.env().subscriber.register(this.filesUpdate.subscribe(this._onFilesUpdate.bind(this)));
        this._subscribe();
    }

    public ngAfterViewInit() {
        this.data.sort = this.sort;
    }

    public ngOnDestroy() {
        this._subscription && this._subscription.unsubscribe();
    }

    public ngOnSortChange() {
        this.detectChanges();
        this.table.renderRows();
    }

    public ngOnDropListDropped(event: CdkDragDrop<FileHolder[]>) {
        this.sort.sort({ id: '', start: '', disableClear: false });
        this._subscription && this._subscription.unsubscribe();
        moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
        this.data = new MatTableDataSource<FileHolder>(event.container.data);
        this._subscribe();
        this.data.sort = this.sort;
        this.event.emit({ type: EEventType.sort, files: event.container.data });
    }

    public ngOnRowSelect(file: FileHolder) {
        file.reverseSelect();
        this.event.next({ type: EEventType.select, files: [] });
    }

    public ngContextMenu(event: MouseEvent, file?: FileHolder) {
        event.stopImmediatePropagation();
        const items = [];
        if (file !== undefined) {
            items.push({
                caption: 'Open File',
                handler: () => {
                    this.event.next({ type: EEventType.open, files: [file] });
                },
                disabled: file.type === FileType.Dlt,
            });
        }
        items.push(
            {
                caption: 'Open Selected',
                handler: () => {
                    this.event.next({
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
                        this.event.next({ type: EEventType.select, files: [] });
                    },
                },
                {
                    caption: `Select Only [${file.type}]`,
                    handler: () => {
                        this.data.data.forEach((f: FileHolder) =>
                            f.type === file.type ? f.select() : f.unselect(),
                        );
                        this.event.next({ type: EEventType.select, files: [] });
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
                        this.event.next({ type: EEventType.select, files: [] });
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
                    this.event.next({ type: EEventType.select, files: [] });
                },
            },
            {
                caption: 'Unselect All',
                handler: () => {
                    this.data.data.forEach((f: FileHolder) => f.unselect());
                    this.event.next({ type: EEventType.select, files: [] });
                },
            },
            {
                caption: 'Reverse Select All',
                handler: () => {
                    this.data.data.forEach((f: FileHolder) => f.reverseSelect());
                    this.event.next({ type: EEventType.select, files: [] });
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
                        this.event.next({ type: EEventType.update, files: [file] });
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
                            this.event.next({ type: EEventType.update, files: removed });
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
                        this.event.next({ type: EEventType.update, files: removed });
                },
            },
            {
                caption: 'Remove All',
                handler: () => {
                    this.data.data = [];
                    this.event.next({ type: EEventType.update, files: [] });
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
            this._subscription = this.data.connect().subscribe((files: FileHolder[]) => {
                files === this.data.data && console.log('Same, duh');
                if (
                    files.length === this.data.data.length &&
                    files.every((file, index) => file === this.data.data[index])
                ) {
                    return;
                }
                this.data.data = files;
                this.event.emit({ type: EEventType.sort, files: files });
            });
        }
    }
}
export interface TabSourceMultipleFilesStructure extends IlcInterface {}
