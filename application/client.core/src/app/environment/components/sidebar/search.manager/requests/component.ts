import { Component, OnDestroy, ChangeDetectorRef, ViewChildren, QueryList, AfterContentInit } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import { Subscription } from 'rxjs';
import SearchSessionsService, { IRequest } from '../../../../services/service.sessions.search';
import { IRequestItem } from './request/component';
import { IRequestItem as IRequestDetailsItem } from './details/component';
import ElectronIpcService, { IPCMessages } from '../../../../services/service.electron.ipc';
import { NotificationsService } from '../../../../services.injectable/injectable.service.notifications';


@Component({
    selector: 'app-sidebar-app-search-requests',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchRequestsComponent implements OnDestroy, AfterContentInit {

    public _ng_requests: IRequestItem[] = [];
    public _ng_selected: IRequestDetailsItem | undefined;
    public _ng_selectedIndex: number = -1;

    private _subscriptions: { [key: string]: Subscription | undefined } = { };

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
        this._subscriptions.onRequestsUpdated = SearchSessionsService.getObservable().onRequestsUpdated.subscribe(this._onRequestsUpdated.bind(this));
        this._ng_requests = this._getRequestItems(SearchSessionsService.getStoredRequests());
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {

    }

    public _ng_onRemoveAll() {
        SearchSessionsService.removeAllStoredRequests();
        this._cdRef.detectChanges();
    }

    public _ng_onSave() {
        if (this._ng_requests.length === 0) {
            return;
        }
        const filters = this._ng_requests.map((request: IRequestItem) => {
            return {
                reg: request.request.reg.source,
                color: request.request.color,
                background: request.request.background,
                active: request.request.active
            };
        });
        ElectronIpcService.request(new IPCMessages.FiltersSaveRequest({ filters: filters }), IPCMessages.FiltersSaveResponse).then((response: IPCMessages.FiltersSaveResponse) => {
            if (response.error !== undefined) {
                return this._notifications.add({
                    caption: 'Filters',
                    message: `Fail to save filters into file "${response.filename}" due error: ${response.error}`
                });
            }
            this._notifications.add({
                caption: 'Filters',
                message: `Filters are saved into file "${response.filename}"`
            });
        }).catch((error: Error) => {
            return this._notifications.add({
                caption: 'Filters',
                message: `Fail to save filters due error: ${error.message}`
            });
        });
    }

    public _ng_onLoad() {
        ElectronIpcService.request(new IPCMessages.FiltersLoadRequest(), IPCMessages.FiltersLoadResponse).then((response: IPCMessages.FiltersLoadResponse) => {
            if (response.error !== undefined) {
                return this._notifications.add({
                    caption: 'Filters',
                    message: `Fail to load filters due error: ${response.error}`
                });
            }
            const filters = response.filters.filter((filter) => {
                return Toolkit.regTools.isRegStrValid(filter.reg);
            });
            SearchSessionsService.removeAllStoredRequests();
            SearchSessionsService.insertStoredRequests(filters.map((filter) => {
                return {
                    reg: Toolkit.regTools.createFromStr(filter.reg) as RegExp,
                    color: filter.color,
                    background: filter.background,
                    active: filter.active,
                };
            }));
        }).catch((error: Error) => {
            return this._notifications.add({
                caption: 'Filters',
                message: `Fail to load filters due error: ${error.message}`
            });
        });
    }

    private _onRequestsUpdated(requests: IRequest[]) {
        const newRequest: IRequest | undefined = this._getNewRequest(requests);
        this._ng_requests = this._getRequestItems(requests);
        if (newRequest === undefined) {
            this._cdRef.detectChanges();
        } else {
            this._onSelect(newRequest);
        }
    }

    private _getRequestItems(requests: IRequest[]): IRequestItem[] {
        return requests.map((request: IRequest, index: number) => {
            return {
                request: request,
                onSelect: this._onSelect.bind(this, request),
                onRemove: this._onRemove.bind(this, request),
                onChangeState: this._onChangeState.bind(this, request)
            };
        });
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
            this._ng_selected = undefined;
            this._ng_selectedIndex = -1;
        } else {
            this._ng_selected = {
                request: request,
                onChange: this._onColorChanged.bind(this, request)
            };
            this._ng_selectedIndex = this._getIndexOfRequest(request);
        }
        this._cdRef.detectChanges();
    }

    private _onRemove(request: IRequest) {
        SearchSessionsService.removeStoredRequest(request.reg.source);
    }

    private _onChangeState(request: IRequest, active: boolean) {
        SearchSessionsService.updateRequest(request.reg.source, { active: active });
        this._cdRef.detectChanges();
    }

    private _onColorChanged(request: IRequest, color: string, background: string) {
        SearchSessionsService.updateRequest(request.reg.source, { color: color, background: background });
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
}
