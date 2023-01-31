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
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { FileHolder } from '../file.holder';
import { MatTable } from '@angular/material/table';
import { Subject } from '@platform/env/subscription';
import { FileType } from '@platform/types/files';
import { TFilesSearchResults } from '../state';

export interface IContextAction {
    type: EContextActionType;
    files?: FileHolder[];
}

export enum EContextActionType {
    update = 'update',
    open = 'open',
}

export const COLUMNS = {
    type: 'type',
    name: 'name',
    path: 'path',
    search: 'search',
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
    implements AfterContentInit, AfterViewInit
{
    columns: string[] = [
        COLUMNS.type,
        COLUMNS.name,
        COLUMNS.path,
        COLUMNS.search,
        COLUMNS.size,
        COLUMNS.modificationDate,
    ];

    @Input() files!: FileHolder[];
    @Input() filesUpdate!: Subject<FileHolder[]>;
    @Input() searchUpdate!: Subject<TFilesSearchResults>;

    @Output() context: EventEmitter<IContextAction> = new EventEmitter();

    @ViewChild(MatSort) sort!: MatSort;
    @ViewChild(MatTable) table!: MatTable<any>;

    public data!: MatTableDataSource<FileHolder>;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit() {
        this.data = new MatTableDataSource<FileHolder>(this.files);
        this.env().subscriber.register(this.filesUpdate.subscribe(this._onFilesUpdate.bind(this)));
        this.env().subscriber.register(
            this.searchUpdate.subscribe(this._onSearchUpdate.bind(this)),
        );
    }

    public ngAfterViewInit() {
        this.data.sort = this.sort;
    }

    public ngOnSortChange() {
        this.detectChanges();
        this.table.renderRows();
    }

    public ngOnRowSelect(file: FileHolder) {
        file.reverseSelect();
        this.context.next({ type: EContextActionType.update });
    }

    public ngContextMenu(event: MouseEvent, file?: FileHolder) {
        event.stopImmediatePropagation();
        const items = [];
        if (file !== undefined) {
            items.push({
                caption: 'Open File',
                handler: () => {
                    this.context.next({ type: EContextActionType.open, files: [file] });
                },
                disabled: file.type === FileType.Dlt,
            });
        }
        items.push(
            {
                caption: 'Open Selected',
                handler: () => {
                    this.context.next({
                        type: EContextActionType.open,
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
                        this.context.next({ type: EContextActionType.update });
                    },
                },
                {
                    caption: `Select Only [${file.type}]`,
                    handler: () => {
                        this.data.data.forEach((f: FileHolder) =>
                            f.type === file.type ? f.select() : f.unselect(),
                        );
                        this.context.next({ type: EContextActionType.update });
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
                        this.context.next({ type: EContextActionType.update });
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
                    this.context.next({ type: EContextActionType.update });
                },
            },
            {
                caption: 'Unselect All',
                handler: () => {
                    this.data.data.forEach((f: FileHolder) => f.unselect());
                    this.context.next({ type: EContextActionType.update });
                },
            },
            {
                caption: 'Reverse Select All',
                handler: () => {
                    this.data.data.forEach((f: FileHolder) => f.reverseSelect());
                    this.context.next({ type: EContextActionType.update });
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
                        this.context.next({ type: EContextActionType.update, files: [file] });
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
                            this.context.next({ type: EContextActionType.update, files: removed });
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
                        this.context.next({ type: EContextActionType.update, files: removed });
                },
            },
            {
                caption: 'Remove All',
                handler: () => {
                    this.data.data = [];
                    this.context.next({ type: EContextActionType.update, files: [] });
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

    private _onSearchUpdate(result: TFilesSearchResults) {
        if (Object.keys(result).length === 0) {
            this.data.data.forEach((file: FileHolder) => {
                file.search = 0;
            });
        } else {
            this.data.data.forEach((file: FileHolder) => {
                const matches: number | undefined = result[file.name];
                if (matches !== undefined) {
                    file.search = matches;
                }
            });
        }
    }
}
export interface TabSourceMultipleFilesStructure extends IlcInterface {}
