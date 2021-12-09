import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    AfterViewInit,
    ViewContainerRef,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Subscription, Subject } from 'rxjs';
import { ControllerComponentsDragDropFiles } from '../../../controller/components/controller.components.dragdrop.files';
import { Session } from '../../../controller/session/session';
import {
    NotificationsService,
    ENotificationType,
} from '../../../services.injectable/injectable.service.notifications';
import { IServices } from '../../../services/shared.services.sidebar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { ErrorStateMatcher } from '@angular/material/core';
import { FormControl, FormGroupDirective, NgForm } from '@angular/forms';
import {
    ControllerFileConcatSession,
    IConcatFile,
} from '../../../controller/controller.file.concat.session';
import { IMenuItem } from '../../../services/standalone/service.contextmenu';

import EventsSessionService from '../../../services/standalone/service.events.session';
import ContextMenuService from '../../../services/standalone/service.contextmenu';
import ElectronEnvService from '../../../services/service.electron.env';

import * as Toolkit from 'chipmunk.client.toolkit';

export class SearchErrorStateMatcher implements ErrorStateMatcher {
    private _valid: boolean = true;

    public isErrorState(
        control: FormControl | null,
        form: FormGroupDirective | NgForm | null,
    ): boolean {
        if (control === null) {
            return false;
        }
        this._valid = Toolkit.regTools.isRegStrValid(control.value);
        return !this._valid;
    }

    public isValid(): boolean {
        return this._valid;
    }
}

enum EState {
    concat = 'concat',
    ready = 'ready',
    search = 'search',
    add = 'add',
}

@Component({
    selector: 'app-sidebar-app-concat-files',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
export class SidebarAppConcatFilesComponent implements OnDestroy, AfterContentInit, AfterViewInit {
    public static StateKey = 'side-bar-concat-view';

    @Input() public services!: IServices;
    @Input() public onBeforeTabRemove!: Subject<void>;
    @Input() public close!: () => void;

    public _ng_search: string = '';
    public _ng_files: MatTableDataSource<IConcatFile> = new MatTableDataSource<IConcatFile>([]);
    public _ng_search_error: SearchErrorStateMatcher = new SearchErrorStateMatcher();
    public _ng_state: EState = EState.ready;

    @ViewChild(MatSort, { static: true }) _ng_sortDirRef!: MatSort;

    private _controller: ControllerFileConcatSession | undefined;
    private _dragdrop: ControllerComponentsDragDropFiles | undefined;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _subscriptionsSession: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppConcatFilesComponent');
    private _keyboard: { ctrl: boolean; cmd: boolean; shift: boolean } = {
        ctrl: false,
        cmd: false,
        shift: false,
    };
    private _lastSelectedIndex: number = -1;
    private _destroyed: boolean = false;

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _vcRef: ViewContainerRef,
        private _notifications: NotificationsService,
    ) {
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        window.addEventListener('keydown', this._onKeyDown, true);
        window.addEventListener('keyup', this._onKeyUp, true);
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        Object.keys(this._subscriptionsSession).forEach((key: string) => {
            this._subscriptionsSession[key].unsubscribe();
        });
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
    }

    public ngAfterContentInit() {
        this._controller = this.services.ConcatFilesService.getController();
        this._subscribe();
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        if (this._controller !== undefined) {
            this._ng_search = this._controller.getRegExpStr();
        }
    }

    public ngAfterViewInit() {
        this._initTableSources();
        this._dragdrop = new ControllerComponentsDragDropFiles(this._vcRef.element.nativeElement);
        this._subscriptions.onFiles = this._dragdrop
            .getObservable()
            .onFiles.subscribe(this._onFilesDropped.bind(this));
        this._subscriptions.onBeforeTabRemove = this.onBeforeTabRemove
            .asObservable()
            .subscribe(this._onBeforeTabRemove.bind(this));
    }

    public _ng_onRemove(file: IConcatFile) {
        if (this._controller === undefined) {
            return;
        }
        this._controller.remove(file.path);
    }

    public _ng_onConcat() {
        if (this._controller === undefined) {
            return;
        }
        this._ng_state = EState.concat;
        this._controller
            .concat()
            .then(() => {
                this.services.ConcatFilesService.closeSidebarView();
            })
            .catch((error: Error) => {
                this._notifications.add({
                    caption: 'Concat',
                    message: `Fail to concat files due error: ${error.message}`,
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

    public _ng_onAddFile() {
        ElectronEnvService.get()
            .showOpenDialog({
                properties: ['openFile', 'showHiddenFiles', 'multiSelections'],
            })
            .then((result: { filePaths: string[] }) => {
                if (!(result.filePaths instanceof Array)) {
                    return;
                }
                if (this._controller === undefined) {
                    return;
                }
                this._ng_state = EState.add;
                this._controller
                    .add(result.filePaths)
                    .catch((error: Error) => {
                        this._notifications.add({
                            caption: 'Concat',
                            message: `Fail add file due error: ${error.message}`,
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
                this._logger.error(`Fail add file to be concat due error: ${openErr.message}`);
            });
    }

    public _ng_onResorted(event: CdkDragDrop<string[]>) {
        if (this._controller === undefined) {
            return;
        }
        const files: IConcatFile[] =
            this._ng_files.sort !== null
                ? this._ng_files.sortData(this._ng_files.filteredData, this._ng_files.sort)
                : [];
        moveItemInArray(files, event.previousIndex, event.currentIndex);
        this._ng_sortDirRef.active = '';
        this._ng_sortDirRef.direction = '';
        this._ng_sortDirRef.sortChange.emit();
        this._controller.set(files);
    }

    public _ng_onSelect(clicked: IConcatFile) {
        if (this._controller === undefined) {
            return;
        }
        const files: IConcatFile[] = this._controller.getFiles();
        const clickedIndex = files.findIndex((file: IConcatFile, index: number) => {
            return file.path === clicked.path;
        });
        if (this._keyboard.shift && this._lastSelectedIndex !== -1) {
            this._controller.set(
                files.map((file: IConcatFile, i: number) => {
                    if (clickedIndex < this._lastSelectedIndex) {
                        if (i >= clickedIndex && i < this._lastSelectedIndex) {
                            file.selected = !file.selected;
                        }
                    } else if (clickedIndex > this._lastSelectedIndex) {
                        if (i > this._lastSelectedIndex && i <= clickedIndex) {
                            file.selected = !file.selected;
                        }
                    } else if (clickedIndex === this._lastSelectedIndex) {
                        if (i === clickedIndex) {
                            file.selected = !file.selected;
                        }
                    }
                    return file;
                }),
            );
        } else {
            clicked.selected = !clicked.selected;
            this._controller.update(clicked.path, clicked);
        }
        this._lastSelectedIndex = clickedIndex;
        this._forceUpdate();
    }

    public _ng_onContexMenu(event: MouseEvent, file: IConcatFile | undefined) {
        if (this._controller === undefined) {
            return;
        }
        const files: IConcatFile[] = this._controller.getFiles();
        const items: IMenuItem[] = [
            {
                caption: `Select All`,
                handler: this._changeSelectionToAll.bind(this, true),
                disabled: files.length > 0 ? false : true,
            },
            {
                caption: `Deselect All`,
                handler: this._changeSelectionToAll.bind(this, false),
                disabled: files.length > 0 ? false : true,
            },
            {
                /* delimiter */
            },
            {
                caption: `Add File`,
                handler: this._ng_onAddFile.bind(this),
            },
            {
                caption: `Remove All`,
                handler: () => {
                    if (this._controller === undefined) {
                        return;
                    }
                    this._controller.drop();
                    this._forceUpdate();
                },
                disabled: files.length > 0 ? false : true,
            },
        ];
        if (this._hasMatches()) {
            items.unshift(
                ...[
                    {
                        caption: `Select with matches`,
                        handler: this._selectOnlyMatches.bind(this),
                    },
                    {
                        caption: `Select without matches`,
                        handler: this._selectOnlyNotMatches.bind(this),
                    },
                    {
                        /* delimiter */
                    },
                ],
            );
        }
        const selected: number = this._getSelectedCount();
        if (file === undefined) {
            if (selected > 0) {
                items.unshift(
                    ...[
                        {
                            caption: `Remove ${selected} item(s)`,
                            handler: () => {
                                this._removeSelected();
                            },
                        },
                        {
                            /* delimiter */
                        },
                    ],
                );
            }
        } else {
            items.unshift(
                ...[
                    {
                        caption: `Remove ${
                            selected > 0
                                ? `${selected} item(s)`
                                : file.name.length > 50
                                ? `${file.name.substr(0, 50)}...`
                                : file.name
                        }`,
                        handler: () => {
                            if (selected === 0) {
                                this._ng_onSelect(file);
                            }
                            this._removeSelected();
                        },
                    },
                    {
                        /* delimiter */
                    },
                ],
            );
        }
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    public _ng_onSearchChange(event: KeyboardEvent) {
        if (event.key !== 'Enter') {
            return;
        }
        if (this._controller === undefined) {
            return;
        }
        this._ng_state = EState.search;
        this._controller
            .search(this._ng_search)
            .catch((error: Error) => {
                this._notifications.add({
                    caption: 'Concat',
                    message: `Fail to search files due error: ${error.message}`,
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

    public _ng_onSortChange() {
        if (this._controller === undefined) {
            return;
        }
        this._ng_files.sort !== null &&
            this._controller.set(
                this._ng_files.sortData(this._ng_files.filteredData, this._ng_files.sort),
            );
    }

    private _initTableSources() {
        if (this._controller === undefined) {
            this._ng_files = new MatTableDataSource<IConcatFile>([]);
        } else {
            this._ng_files = new MatTableDataSource<IConcatFile>(this._controller.getFiles());
        }
        this._ng_files.filterPredicate = (stat: IConcatFile, filter: string) => {
            return stat.name.trim().toLowerCase().includes(filter);
        };
        this._ng_files.sort = this._ng_sortDirRef;
    }

    private _onSessionChange(session: Session | undefined) {
        if (session === undefined) {
            this._controller = undefined;
        } else {
            this._controller = this.services.ConcatFilesService.getController(session.getGuid());
        }
        if (this._controller !== undefined) {
            this._ng_search = this._controller.getRegExpStr();
        }
        this._initTableSources();
        this._subscribe();
        this._forceUpdate();
    }

    private _hasMatches(): boolean {
        if (this._controller === undefined) {
            return false;
        }
        let matches: boolean = false;
        this._controller.getFiles().forEach((file: IConcatFile) => {
            if (matches) {
                return;
            }
            if (file.matches > 0) {
                matches = true;
            }
        });
        return matches;
    }

    private _selectOnlyMatches() {
        if (this._controller === undefined) {
            return;
        }
        this._controller.set(
            this._controller.getFiles().map((file: IConcatFile) => {
                file.selected = file.matches > 0;
                return file;
            }),
        );
    }

    private _selectOnlyNotMatches() {
        if (this._controller === undefined) {
            return;
        }
        this._controller.set(
            this._controller.getFiles().map((file: IConcatFile) => {
                file.selected = !(file.matches > 0);
                return file;
            }),
        );
    }

    private _onKeyDown(event: KeyboardEvent) {
        if (event.ctrlKey) {
            this._keyboard.ctrl = true;
        }
        if (event.shiftKey) {
            this._keyboard.shift = true;
        }
        if (event.metaKey) {
            this._keyboard.cmd = true;
        }
    }

    private _onKeyUp() {
        this._keyboard = { ctrl: false, cmd: false, shift: false };
    }

    private _removeSelected() {
        if (this._controller === undefined) {
            return;
        }
        this._controller.set(this._controller.getFiles().filter((f) => !f.selected));
    }

    private _changeSelectionToAll(selected: boolean) {
        if (this._controller === undefined) {
            return;
        }
        this._controller.set(
            this._controller.getFiles().map((file: IConcatFile) => {
                file.selected = selected;
                return file;
            }),
        );
    }

    private _getSelectedCount(): number {
        if (this._controller === undefined) {
            return 0;
        }
        let count: number = 0;
        this._controller.getFiles().forEach((file: IConcatFile) => {
            count += file.selected ? 1 : 0;
        });
        return count;
    }

    private _onBeforeTabRemove() {
        if (this._controller === undefined) {
            return;
        }
        this._controller.drop();
    }

    private _onFilesDropped(files: File[]) {
        this.services.FileOpenerService.concat(
            this.services.FileOpenerService.converFilesToIFiles(files),
        );
    }

    private _subscribe() {
        Object.keys(this._subscriptionsSession).forEach((key: string) => {
            this._subscriptionsSession[key].unsubscribe();
        });
        if (this._controller === undefined) {
            return;
        }
        this._subscriptionsSession.FilesUpdated = this._controller
            .getObservable()
            .FilesUpdated.subscribe(this._onFilesUpdated.bind(this));
        this._subscriptionsSession.FileUpdated = this._controller
            .getObservable()
            .FileUpdated.subscribe(this._onFileUpdated.bind(this));
    }

    private _onFilesUpdated(files: IConcatFile[]) {
        this._initTableSources();
        this._forceUpdate();
    }

    private _onFileUpdated(file: IConcatFile) {
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
