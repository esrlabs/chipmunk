import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit, AfterViewInit, ViewContainerRef } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import * as Toolkit from 'logviewer.client.toolkit';
import { Subscription, Subject } from 'rxjs';
import ElectronIpcService, { IPCMessages } from '../../../services/service.electron.ipc';
import { ControllerComponentsDragDropFiles } from '../../../controller/components/controller.components.dragdrop.files';
import SessionsService from '../../../services/service.sessions.tabs';
import EventsHubService from '../../../services/standalone/service.eventshub';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import * as moment from 'moment';
import ContextMenuService, { IMenuItem } from '../../../services/standalone/service.contextmenu';
import { NotificationsService } from '../../../services.injectable/injectable.service.notifications';
import { IServices, IFile } from '../../../services/shared.services.sidebar';

declare var Electron: any;

interface IFileInfo {
    parser: string;
    path: string;
    name: string;
    size: number;
    created: number;
    changed: number;
    createdStr: string;
    changedStr: string;
    selected: boolean;
    request: string;
    matches: number;
}

interface IState {
    _ng_busy: boolean;
    _ng_files: IFileInfo[];
}

const CSortProps = {
    size: 'size',
    name: 'name',
    created: 'created',
    changed: 'changed',
};

@Component({
    selector: 'app-sidebar-app-concat-files',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppConcatFilesComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    public static StateKey = 'side-bar-concat-view';

    @Input() public services: IServices;
    @Input() public onBeforeTabRemove: Subject<void>;
    @Input() public close: () => void;

    public _ng_busy: boolean = false;
    public _ng_session: ControllerSessionTab | undefined;
    public _ng_files: IFileInfo[] = [];
    public _ng_sorting: { prop: string, abc: boolean } = { prop: 'name', abc: true };
    public _ng_search: string = '';

    private _dragdrop: ControllerComponentsDragDropFiles | undefined;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppConcatFilesComponent');
    private _keyboard: { ctrl: boolean, cmd: boolean, shift: boolean } = { ctrl: false, cmd: false, shift: false };
    private _lastSelectedIndex: number = -1;
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef,
                private _notifications: NotificationsService) {
        this._ng_session = SessionsService.getActive();
        this._subscriptions.onSessionChange = SessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._ng_onSearchValidate = this._ng_onSearchValidate.bind(this);
        this._ng_onSearchChange = this._ng_onSearchChange.bind(this);
        this._ng_onSearchEnter = this._ng_onSearchEnter.bind(this);
        window.addEventListener('keydown', this._onKeyDown, true);
        window.addEventListener('keyup', this._onKeyUp, true);
    }

    public ngOnDestroy() {
        this._destroyed = true;
        this._saveState();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
    }

    public ngAfterContentInit() {
        this._subscriptions.onFilesToBeConcat = this.services.FileOpenerService.getObservable().onFilesToBeConcat.subscribe(this._onFilesToBeConcat.bind(this));
    }

    public ngAfterViewInit() {
        this._dragdrop = new ControllerComponentsDragDropFiles(this._vcRef.element.nativeElement);
        this._subscriptions.onFiles = this._dragdrop.getObservable().onFiles.subscribe(this._onFilesDropped.bind(this));
        this._subscriptions.onBeforeTabRemove = this.onBeforeTabRemove.asObservable().subscribe(this._onBeforeTabRemove.bind(this));
        this._loadState();
    }

    public _ng_onRemove(file: IFileInfo) {
        this._ng_files = this._ng_files.filter(f => f.path !== file.path);
        this._forceUpdate();
    }

    public _ng_onConcat() {
        this._ng_busy = true;
        this._forceUpdate();
        EventsHubService.getSubject().onKeepScrollPrevent.next();
        ElectronIpcService.request(new IPCMessages.ConcatFilesRequest({
            files: this._ng_files.map((file: IFileInfo) => {
                return {
                    parser: file.parser,
                    file: file.path,
                };
            }),
            id: Toolkit.guid(),
            session: this._ng_session.getGuid(),
        }), IPCMessages.ConcatFilesResponse).then((response: IPCMessages.ConcatFilesResponse) => {
            this._ng_busy = false;
            if (typeof response.error === 'string' && response.error.trim() !== '') {
                this._notifications.add({
                    caption: `Concating ${this._ng_files.length} files`,
                    message: `Fail to concat files due error: ${response.error}`
                });
                return this._forceUpdate();
            }
            this._ng_files = [];
            this.close();
            this._forceUpdate();
        }).catch((error: Error) => {
            this._notifications.add({
                caption: `Concating ${this._ng_files.length} files`,
                message: `Fail to concat files due error: ${error.message}`
            });
            this._logger.error(`Error during concat: ${error.message}`);
            this._ng_busy = false;
            this._forceUpdate();
        });
    }

    public _ng_onAddFile() {
        Electron.remote.dialog.showOpenDialog({
            properties: ['openFile', 'showHiddenFiles']
        }, (files: string[]) => {
            if (!(files instanceof Array) || files.length !== 1) {
                return;
            }
            this._addFileByPath(files[0]).then(() => {
                this._resort();
                this._forceUpdate();
            });
        });
    }

    public _ng_onResorted(event: CdkDragDrop<string[]>) {
        const target: IFileInfo = Object.assign({}, this._ng_files[event.previousIndex]);
        this._ng_files = this._ng_files.filter((file: IFileInfo, i: number) => {
            return i !== event.previousIndex;
        });
        this._ng_files.splice(event.currentIndex, 0, target);
        this._forceUpdate();
    }

    public _ng_sortBy(prop: string) {
        if (this._ng_sorting.prop === prop) {
            this._ng_sorting.abc = !this._ng_sorting.abc;
        } else {
            this._ng_sorting.prop = prop;
            this._ng_sorting.abc = true;
        }
        this._resort();
        this._forceUpdate();
    }

    public _ng_onSelect(clicked: IFileInfo) {
        if (this._keyboard.shift && this._lastSelectedIndex !== -1) {
            const clickedIndex = this._getIndexOf(clicked);
            this._ng_files = this._ng_files.map((file: IFileInfo, i: number) => {
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
            });
        } else {
            this._ng_files = this._ng_files.map((file: IFileInfo) => {
                if (file.path === clicked.path) {
                    file.selected = !file.selected;
                }
                return file;
            });
        }
        this._lastSelectedIndex = this._getIndexOf(clicked);
        this._forceUpdate();
    }

    public _ng_onContexMenu(event: MouseEvent, file: IFileInfo) {
        const items: IMenuItem[] = [
            {
                caption: `Select All`,
                handler: this._changeSelectionToAll.bind(this, true),
                disabled: this._ng_files.length > 0 ? false : true,
            },
            {
                caption: `Deselect All`,
                handler: this._changeSelectionToAll.bind(this, false),
                disabled: this._ng_files.length > 0 ? false : true,
            },
            { /* delimiter */ },
            {
                caption: `Add File`,
                handler: this._ng_onAddFile.bind(this),
            },
            {
                caption: `Remove All`,
                handler: () => {
                    this._ng_files = [];
                    this._forceUpdate();
                },
                disabled: this._ng_files.length > 0 ? false : true,
            },
        ];
        if (this._hasMatches()) {
            items.unshift(...[
                {
                    caption: `Select with matches`,
                    handler: this._selectOnlyMatches.bind(this),
                },
                {
                    caption: `Select without matches`,
                    handler: this._selectOnlyNotMatches.bind(this),
                },
                { /* delimiter */ },
            ]);
        }
        if (this._ng_files.length > 1) {
            items.unshift(...[
                {
                    caption: `Sort by Name`,
                    handler: this._ng_sortBy.bind(this, CSortProps.name),
                },
                {
                    caption: `Sort by Size`,
                    handler: this._ng_sortBy.bind(this, CSortProps.size),
                },
                {
                    caption: `Sort by Create Date`,
                    handler: this._ng_sortBy.bind(this, CSortProps.created),
                },
                {
                    caption: `Sort by Last Change date`,
                    handler: this._ng_sortBy.bind(this, CSortProps.changed),
                },
                { /* delimiter */ },
            ]);
        }

        const selected: number = this._getSelectedCount();
        if (file === undefined) {
            if (selected > 0) {
                items.unshift(...[
                    {
                        caption: `Remove ${selected} item(s)`,
                        handler: () => {
                            this._removeSelected();
                        },
                    },
                    { /* delimiter */ }
                ]);
            }
        } else {
            items.unshift(...[
                {
                    caption: `Remove ${selected > 0 ? `${selected} item(s)` : file.name.length > 50 ? `${file.name.substr(0, 50)}...` : file.name}`,
                    handler: () => {
                        if (selected === 0) {
                            this._ng_onSelect(file);
                        }
                        this._removeSelected();
                    },
                },
                { /* delimiter */ }
            ]);
        }
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    public _ng_onSearchValidate(value: string) {
        if (!Toolkit.regTools.isRegStrValid(value)) {
            return 'Invalid search request';
        }
        return undefined;
    }

    public _ng_onSearchChange(value: string) {
        this._ng_search = value;
    }

    public _ng_onSearchEnter(value: string) {
        if (value.trim() === '') {
            return;
        }
        if (!Toolkit.regTools.isRegStrValid(value)) {
            return;
        }
        if (this._ng_files.length === 0) {
            return;
        }
        this._ng_busy = true;
        this._forceUpdate();
        ElectronIpcService.request(new IPCMessages.FilesSearchRequest({
            files: this._ng_files.map((file: IFileInfo) => {
                return file.path;
            }),
            requests: [
                { source: value, flags: 'gi'}
            ],
        }), IPCMessages.FilesSearchResponse).then((response: IPCMessages.FilesSearchResponse) => {
            this._ng_busy = false;
            if (typeof response.error === 'string' && response.error.trim() !== '') {
                this._notifications.add({
                    caption: `Search in ${this._ng_files.length} files`,
                    message: `Fail to search files due error: ${response.error}`
                });
                this._forceUpdate();
                return;
            }
            if (typeof response.matches !== 'object' || response.matches === null) {
                this._ng_search = '';
                this._forceUpdate();
                return;
            }
            this._ng_files = this._ng_files.map((file: IFileInfo) => {
                if (response.matches[file.path] === undefined) {
                    file.matches = 0;
                    file.request = '';
                } else {
                    file.matches = response.matches[file.path];
                    file.request = value;
                }
                return file;
            });
            this._forceUpdate();
        }).catch((error: Error) => {
            this._notifications.add({
                caption: `Search in ${this._ng_files.length} files`,
                message: `Fail to search files due error: ${error.message}`
            });
            this._ng_busy = false;
            this._forceUpdate();
        });
    }

    private _hasMatches(): boolean {
        let matches: boolean = false;
        this._ng_files.forEach((file: IFileInfo) => {
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
        this._ng_files = this._ng_files.map((file: IFileInfo) => {
            file.selected = file.matches > 0;
            return file;
        });
        this._forceUpdate();
    }

    private _selectOnlyNotMatches() {
        this._ng_files = this._ng_files.map((file: IFileInfo) => {
            file.selected = !(file.matches > 0);
            return file;
        });
        this._forceUpdate();
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
        this._ng_files = this._ng_files.filter(f => !f.selected);
        this._forceUpdate();
    }

    private _changeSelectionToAll(selected: boolean) {
        this._ng_files = this._ng_files.map((file: IFileInfo) => {
            file.selected = selected;
            return file;
        });
        this._forceUpdate();
    }

    private _getSelectedCount(): number {
        let count: number = 0;
        this._ng_files.forEach((file: IFileInfo) => {
            count += (file.selected ? 1 : 0);
        });
        return count;
    }

    private _onBeforeTabRemove() {
        this._ng_session.getSessionsStates().drop(this._getStateGuid());
    }

    private _loadState(): void {
        if (this._ng_session === undefined) {
            return;
        }
        if (!this._ng_session.getSessionsStates().applyStateTo(this._getStateGuid(), this)) {

        }
        this._onFilesToBeConcat(this.services.FileOpenerService.getPendingFiles());
    }

    private _saveState(): void {
        if (this._ng_session === undefined) {
            return;
        }
        this._ng_session.getSessionsStates().set<IState>(
            this._getStateGuid(),
            {
                _ng_busy: this._ng_busy,
                _ng_files: this._ng_files,
            }
        );
    }

    private _dropState(): void {
        this._ng_busy = false;
        this._ng_files = [];
    }

    private _getStateGuid(): string {
        return `${SidebarAppConcatFilesComponent.StateKey}:${this._ng_session.getGuid()}`;
    }

    private _getIndexOf(target: IFileInfo): number {
        let index: number = -1;
        this._ng_files.forEach((file: IFileInfo, i: number) => {
            if (file.path === target.path) {
                index = i;
            }
        });
        return index;
    }

    private _onSessionChange(session: ControllerSessionTab) {
        // Save previos
        this._saveState();
        // Drop state before
        this._dropState();
        // Change session
        this._ng_session = session;
        if (session !== undefined) {
            // Try to load
            this._loadState();
        }
        // Update
        this._forceUpdate();
    }


    private _onFilesDropped(files: IFile[]) {
        this.services.FileOpenerService.concat(files);
    }

    private _onFilesToBeConcat(files: IFile[]) {
        this.services.FileOpenerService.dropPendingFiles();
        if (files.length === 0) {
            return;
        }
        Promise.all(files.map((file: IFile) => {
            return this._addFileByPath(file.path);
        })).then(() => {
            this._resort();
            this._forceUpdate();
        }).catch((error: Error) => {
            this._notifications.add({
                caption: `Concating`,
                message: `Fail to add files due error: ${error.message}`
            });
            this._forceUpdate();
        });
    }

    private _doesExist(path: string): boolean {
        let result: boolean = false;
        this._ng_files.forEach((item) => {
            if (item.path === path) {
                result = true;
            }
        });
        return result;
    }

    private _addFileByPath(path: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._doesExist(path)) {
                return resolve();
            }
            this._getFileStats(path).then((stats: IPCMessages.FileInfoResponse) => {
                this._ng_files.push({
                    path: stats.path,
                    name: stats.name,
                    parser: stats.parser,
                    size: stats.size,
                    created: stats.created,
                    changed: stats.changed,
                    createdStr: moment(stats.created).format('DD/MM/YYYY hh:mm:ss.s'),
                    changedStr: moment(stats.changed).format('DD/MM/YYYY hh:mm:ss.s'),
                    selected: false,
                    matches: 0,
                    request: ''
                });
                resolve();
            }).catch((parserError: Error) => {
                reject(new Error(`Fail detect file parser due error: ${parserError.message}`));
            });
        });
    }

    private _getFileStats(file: string): Promise<IPCMessages.FileInfoResponse> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.FileInfoRequest({
                file: file,
            }), IPCMessages.FileInfoResponse).then((stats: IPCMessages.FileInfoResponse) => {
                if (stats.parser === undefined && stats.defaults !== undefined) {
                    this._logger.env(`Parser isn't found for file: ${file}. Will be used default: ${stats.defaults}`);
                    stats.parser = stats.defaults;
                } else if (stats.parser === undefined && stats.defaults === undefined) {
                    return reject(new Error(`Fail to find parser for selected file: ${file}.`));
                }
                resolve(stats);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _resort() {
        this._ng_files.sort((a: IFileInfo, b: IFileInfo) => {
            return this._ng_sorting.abc ?
                (a[this._ng_sorting.prop] > b[this._ng_sorting.prop] ? 1 : a[this._ng_sorting.prop] < b[this._ng_sorting.prop] ? -1 : 0)
                :
                (a[this._ng_sorting.prop] < b[this._ng_sorting.prop] ? 1 : a[this._ng_sorting.prop] > b[this._ng_sorting.prop] ? -1 : 0);
        });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
