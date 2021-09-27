import ContextMenuService, { IMenuItem } from '../services/standalone/service.contextmenu';

import { ITabAPI } from 'chipmunk-client-material';

import * as Toolkit from 'chipmunk.client.toolkit';

export class ControllerSessionTabTitleContextMenu {
    private _logger: Toolkit.Logger;
    private _sessionId: string;
    private _tabAPI: ITabAPI;
    private _menu: IMenuItem[] = [];

    constructor(guid: string, api: ITabAPI) {
        this._sessionId = guid;
        this._tabAPI = api;
        this._menu.push({
            caption: 'Close',
            handler: () => {
                this._tabAPI.close();
            },
        });
        this._tabAPI.subjects.onTitleContextMenu.subscribe(this._onTabTitleContextMenu.bind(this));
        this._logger = new Toolkit.Logger(`TabTitleContextMenu: ${guid}`);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    public push(item: IMenuItem): Error | undefined {
        if (typeof item.id !== 'string') {
            return new Error(`ID of menu item should be defined`);
        }
        if (this._exist(item.id)) {
            return new Error(`Item with ID "${item.id}" already exist`);
        }
        this._menu.push(item);
        return undefined;
    }

    public unshift(item: IMenuItem): Error | undefined {
        if (typeof item.id !== 'string') {
            return new Error(`ID of menu item should be defined`);
        }
        if (this._exist(item.id)) {
            return new Error(`Item with ID "${item.id}" already exist`);
        }
        this._menu.unshift(item);
        return undefined;
    }

    public delete(id: string) {
        this._menu = this._menu.filter((item: IMenuItem) => {
            return item.id !== id;
        });
    }

    public update(
        updated: IMenuItem,
        cmdIfDoesNotExist?: 'push' | 'unshift' | undefined,
    ): Error | undefined {
        if (typeof updated.id !== 'string') {
            return new Error(`ID of menu item should be defined`);
        }
        let updatedFlag: boolean = false;
        this._menu = this._menu.map((item: IMenuItem) => {
            if (item.id === updated.id) {
                updatedFlag = true;
                return updated;
            } else {
                return item;
            }
        });
        if (!updatedFlag && cmdIfDoesNotExist !== undefined) {
            switch (cmdIfDoesNotExist) {
                case 'push':
                    this.push(updated);
                    break;
                case 'unshift':
                    this.unshift(updated);
                    break;
            }
        }
        return undefined;
    }

    private _exist(id: string): boolean {
        let exist: boolean = false;
        this._menu.forEach((item: IMenuItem) => {
            if (item.id === id) {
                exist = true;
            }
        });
        return exist;
    }

    private _onTabTitleContextMenu(event: MouseEvent) {
        ContextMenuService.show({
            items: this._menu,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }
}
