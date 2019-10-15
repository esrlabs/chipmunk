import { Component, OnDestroy, ChangeDetectorRef, AfterContentInit, ViewChild, AfterViewInit, Input, ElementRef } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import { Subscription, Subject, Observable } from 'rxjs';
import SessionsService from '../../../../services/service.sessions.tabs';
import SidebarSessionsService from '../../../../services/service.sessions.sidebar';
import SearchSessionsService, { IRequest } from '../../../../services/service.sessions.search';
import { IRequestItem } from './request/component';
import { IRequestItem as IRequestDetailsItem, SidebarAppSearchRequestDetailsComponent } from './details/component';
import { NotificationsService } from '../../../../services.injectable/injectable.service.notifications';
import { IComponentDesc } from 'logviewer-client-containers';
import { SidebarAppSearchManagerControlsComponent } from './controls/component';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import ContextMenuService, { IMenu, IMenuItem } from '../../../../services/standalone/service.contextmenu';

interface IState {
    _ng_selectedIndex: number;
    _ng_filename: string | undefined;
    _filename: string | undefined;
    _changed: boolean;
}

@Component({
    selector: 'app-sidebar-app-search-requests',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchRequestsComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    public static StateKey = 'sidebar-app-search-requests';

    @Input() public injectionIntoTitleBar: Subject<IComponentDesc>;

    @ViewChild('details') _detailsCom: SidebarAppSearchRequestDetailsComponent;
    @ViewChild('list') _listElmRef: ElementRef;

    public _ng_requests: IRequestItem[] = [];
    public _ng_selected: IRequestDetailsItem | undefined;
    public _ng_selectedIndex: number = -1;
    public _ng_filename: string | undefined;

    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppSearchRequestsComponent');
    private _destroyed: boolean = false;
    private _session: ControllerSessionTab | undefined;
    private _focused: boolean = false;
    private _filename: string | undefined;
    private _changed: boolean = false;
    private _subjects: {
        onEdit: Subject<IRequest>,
        onEditCancel: Subject<void>,
        onFileReset: Subject<void>,
        onChanges: Subject<void>,
    } = {
        onEdit: new Subject<IRequest>(),
        onEditCancel: new Subject<void>(),
        onFileReset: new Subject<void>(),
        onChanges: new Subject<void>(),
    };

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
        this._subscriptions.onRequestsUpdated = SearchSessionsService.getObservable().onRequestsUpdated.subscribe(this._onRequestsUpdated.bind(this));
        this._subscriptions.onSessionChange = SessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._ng_requests = this._getRequestItems(SearchSessionsService.getStoredRequests());
        this._onKeyPress = this._onKeyPress.bind(this);
        this._session = SessionsService.getActive();
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        // SidebarSessionsService.setTitleInjection(undefined);
        window.removeEventListener('keyup', this._onKeyPress);
    }

    public ngAfterContentInit() {
    }

    public ngAfterViewInit() {
        this._loadState();
        window.addEventListener('keyup', this._onKeyPress);
        SidebarSessionsService.setTitleInjection({
            factory: SidebarAppSearchManagerControlsComponent,
            resolved: false,
            inputs: {
                setCurrentFilename: this._setCurrentFileName.bind(this),
                onFileReset: this._subjects.onFileReset.asObservable(),
                onChanges: this._subjects.onChanges.asObservable(),
                dropChangesFlag: () => {
                    this._changed = false;
                    this._saveState();
                },
                filename: this._filename,
                changed: this._changed,
            }
        });
    }

    public _ng_onRemoveAll() {
        SearchSessionsService.removeAllStoredRequests();
        this._subjects.onFileReset.next();
        this._ng_filename = undefined;
        this._filename = undefined;
        this._forceUpdate();
    }

    public _ng_onFocus() {
        this._focused = true;
    }

    public _ng_onBlur() {
        this._focused = false;
    }

    public _ng_onContexMenu(event: MouseEvent, request?: IRequestItem) {
        const items: IMenuItem[] = [];
        if (request !== undefined) {
            items.push(...[
                {
                    caption: `Edit`,
                    handler: () => {
                        this._subjects.onEdit.next(request.request);
                    },
                },
                { /* delimiter */ },
                {
                    caption: request.request.active ? `Deactivate` : `Activate`,
                    handler: () => {
                        this._onChangeState(request.request, !request.request.active);
                    },
                },
                { /* delimiter */ },
                {
                    caption: `Deactivate all`,
                    handler: () => {
                        this._toggleAllExcept(undefined, true);
                    },
                },
                {
                    caption: `Activate all`,
                    handler: () => {
                        this._toggleAllExcept(undefined, false);
                    },
                },
                {
                    caption: `Deactivate all except this`,
                    handler: () => {
                        this._toggleAllExcept(request.request.reg.source, true);
                    },
                },
                {
                    caption: `Activate all except this`,
                    handler: () => {
                        this._toggleAllExcept(request.request.reg.source, false);
                    },
                },
                { /* delimiter */ },
                {
                    caption: `Remove`,
                    handler: () => {
                        this._onRemove(request.request);
                    },
                },
                {
                    caption: `Remove All`,
                    handler: () => {
                        this._ng_onRemoveAll();
                    },
                },
            ]);
        }
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
    }

    private _setCurrentFileName(filename: string) {
        this._ng_filename = Toolkit.basename(filename);
        this._filename = filename;
        this._saveState();
        this._cdRef.detectChanges();
    }

    private _onKeyPress(event: KeyboardEvent) {
        if (!this._focused) {
            return;
        }
        if (this._ng_requests.length === 0) {
            return;
        }
        switch (event.key) {
            case 'ArrowDown':
                if (this._ng_selectedIndex === -1 || this._ng_selectedIndex === this._ng_requests.length - 1) {
                    this._selectByIndex(0);
                } else {
                    this._selectByIndex(this._ng_selectedIndex + 1);
                }
                break;
            case 'ArrowUp':
                if (this._ng_selectedIndex === -1 || this._ng_selectedIndex === 0) {
                    this._selectByIndex(this._ng_requests.length - 1);
                } else {
                    this._selectByIndex(this._ng_selectedIndex - 1);
                }
                break;
            case 'Enter':
                if (this._ng_selectedIndex !== -1) {
                    this._subjects.onEdit.next(this._ng_selected.request);
                }
                break;
        }
    }

    private _getStateGuid(): string | undefined {
        if (this._session === undefined) {
            return;
        }
        return `${SidebarAppSearchRequestsComponent.StateKey}:${this._session.getGuid()}`;
    }

    private _loadState(): void {
        if (this._session === undefined) {
            return;
        }
        const key: string | undefined = this._getStateGuid();
        this._session.getSessionsStates().applyStateTo(key, this);
        this._selectByIndex(this._ng_selectedIndex);
        this._forceUpdate();
    }

    private _saveState(): void {
        if (this._session === undefined || this._ng_requests.length === 0) {
            return;
        }
        const key: string | undefined = this._getStateGuid();
        this._session.getSessionsStates().set<IState>(
            key,
            {
                _ng_selectedIndex: this._ng_selectedIndex,
                _ng_filename: this._ng_filename,
                _filename: this._filename,
                _changed: this._changed,
            }
        );
    }

    private _onRequestsUpdated(requests: IRequest[]) {
        const session = SessionsService.getActive();
        if (session === undefined || this._session === undefined) {
            return;
        }
        if (session.getGuid() !== this._session.getGuid()) {
            return;
        }
        const newRequest: IRequest | undefined = this._getNewRequest(requests);
        this._ng_requests = this._getRequestItems(requests);
        if (newRequest === undefined) {
            if (this._ng_requests.length === 0) {
                this._ng_selected = undefined;
                this._ng_selectedIndex = -1;
            }
            this._forceUpdate();
        } else {
            this._onSelect(newRequest);
        }
    }

    private _getRequestItems(requests: IRequest[]): IRequestItem[] {
        return requests.map((request: IRequest, index: number) => {
            return {
                request: request,
                onEdit: this._subjects.onEdit.asObservable(),
                onEditCancel: this._subjects.onEditCancel.asObservable(),
                onSelect: this._onSelect.bind(this, request),
                onChangeState: this._onChangeState.bind(this, request),
                onEditDone: this._onRequestValueChanged.bind(this, request),
            };
        });
    }

    private _onRequestValueChanged(request: IRequest, value?: string) {
        this._subjects.onEditCancel.next();
        this._focus();
        if (value === undefined) {
            return;
        }
        SearchSessionsService.updateRequest(request.reg.source, { reguest: value });
        this._subjects.onChanges.next();
        this._changed = true;
        this._saveState();
    }

    private _focus() {
        if (this._listElmRef === undefined) {
            return;
        }
        this._listElmRef.nativeElement.focus();
    }

    private _getNewRequest(requests: IRequest[]): IRequest | undefined {
        let result: IRequest | undefined;
        requests.forEach((request: IRequest) => {
            let exist: boolean = false;
            this._ng_requests.forEach((stored: IRequestItem) => {
                if (stored.request.reg.source === request.reg.source) {
                    exist = true;
                }
            });
            if (!exist) {
                result = request;
            }
        });
        return result;
    }

    private _onSelect(request: IRequest) {
        if (this._ng_selected !== undefined && this._ng_selected.request.reg.source === request.reg.source) {
            return;
        }
        this._selectByIndex(this._getIndexOfRequest(request));
    }

    private _onRemove(request: IRequest) {
        SearchSessionsService.removeStoredRequest(request.reg.source);
    }

    private _onChangeState(request: IRequest, active: boolean) {
        SearchSessionsService.updateRequest(request.reg.source, { active: active });
        this._forceUpdate();
    }

    private _onColorChanged(request: IRequest, color: string, background: string) {
        SearchSessionsService.updateRequest(request.reg.source, { color: color, background: background });
    }

    private _selectByIndex(index: number) {
        if (this._ng_requests[index] === undefined) {
            return;
        }
        this._ng_selected = {
            request: this._ng_requests[index].request,
            onChange: this._onColorChanged.bind(this, this._ng_requests[index].request),
        };
        this._ng_selectedIndex = index;
        this._saveState();
        this._forceUpdate();
    }

    private _getIndexOfRequest(request: IRequest) {
        let index: number = -1;
        this._ng_requests.forEach((item: IRequestItem, i: number) => {
            if (item.request.reg.source === request.reg.source) {
                index = i;
            }
        });
        return index;
    }

    private _onSessionChange(controller: ControllerSessionTab) {
        if (controller === undefined) {
            return;
        }
        this._session = controller;
        this._onRequestsUpdated(SearchSessionsService.getStoredRequests());
    }

    private _toggleAllExcept(source: string | undefined, targetState: boolean) {
        const requests: IRequest[] = this._ng_requests.map((item: IRequestItem) => {
            item.request.active = item.request.reg.source === source ? targetState : !targetState;
            return Object.assign({}, item.request);
        });
        SearchSessionsService.overwriteStored(requests);
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
