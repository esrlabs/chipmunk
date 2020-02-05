import ContextMenuService, { IMenuItem } from '../services/standalone/service.contextmenu';

import { ITabAPI } from 'chipmunk-client-complex';

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
        this._menu.push(item);
    }

    public unshift(item: IMenuItem): Error | undefined {
        if (typeof item.id !== 'string') {
            return new Error(`ID of menu item should be defined`);
        }
        this._menu.unshift(item);
    }

    public delete(id: string) {
        this._menu = this._menu.filter((item: IMenuItem) => {
            return item.id !== id;
        });
    }

    public update(updated: IMenuItem) {
        if (typeof updated.id !== 'string') {
            return new Error(`ID of menu item should be defined`);
        }
        this._menu = this._menu.map((item: IMenuItem) => {
            if (item.id === updated.id) {
                return updated;
            } else {
                return item;
            }
        });
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
