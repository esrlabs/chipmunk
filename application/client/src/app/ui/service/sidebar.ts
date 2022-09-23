import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { ui } from '@register/services';
import { ilc, Emitter, Channel, Declarations, Services } from '@service/ilc';

import { TabsService, ITab } from '@elements/tabs/service';
import { UUIDs } from './sidebar/register';
import { Tabs } from './sidebar/tabs';

@SetupService(ui['sidebar'])
export class Service extends Implementation {
    private _emitter!: Emitter;
    private _channel!: Channel;
    private _services!: Services;
    private _available!: Tabs;
    private _active: string | undefined;
    private _sessions: Map<string, TabsService> = new Map();

    public override ready(): Promise<void> {
        this._emitter = ilc.emitter(this.getName(), this.log());
        this._channel = ilc.channel(this.getName(), this.log());
        this._services = ilc.services(this.getName(), this.log());
        this._channel.session.change(this._onSessionChange.bind(this));
        this._channel.session.closed(this._onSessionClosed.bind(this));
        this._channel.ui.sidebar.view(this._onViewChange.bind(this));
        this._available = new Tabs();
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this._sessions.forEach((serivce: TabsService) => {
            serivce.clear();
        });
        this._sessions.clear();
        return Promise.resolve();
    }

    public add(tabs: ITab[] | ITab) {
        if (this._active === undefined) {
            return;
        }
        const service: TabsService | undefined = this._sessions.get(this._active);
        if (service === undefined) {
            return;
        }
        tabs = tabs instanceof Array ? tabs : [tabs];
        // Add tabs
        tabs.forEach((tab: ITab) => {
            if (tab.uuid === undefined) {
                return;
            }
            const uuid = tab.uuid;
            if (!service.has(tab.uuid)) {
                const tab: ITab | undefined = this._available.get(uuid);
                if (tab === undefined) {
                    return;
                }
                service.add(tab);
            }
        });
    }

    public addByGuid(uuid: string) {
        if (this._active === undefined) {
            return;
        }
        const tab: ITab | undefined = this._available.get(uuid);
        const service: TabsService | undefined = this._sessions.get(this._active);
        if (service === undefined || tab === undefined) {
            return;
        }
        if (tab.uuid === undefined) {
            return;
        }
        if (service.has(tab.uuid)) {
            return;
        }
        service.add(tab);
    }

    public remove(uuid: string) {
        if (this._active === undefined) {
            return;
        }
        const service: TabsService | undefined = this._sessions.get(this._active);
        if (service === undefined) {
            return;
        }
        service.remove(uuid);
        return;
    }

    public has(tab: string): boolean {
        if (this._active === undefined) {
            return false;
        }
        const service: TabsService | undefined = this._sessions.get(this._active);
        if (service === undefined) {
            return false;
        }
        return service.has(tab);
    }

    public setActive(uuid: string, openTabOnly: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._active === undefined) {
                return reject(new Error(this.log().warn(`Session uuid isn't defined`)));
            }
            const service: TabsService | undefined = this._sessions.get(this._active);
            if (service === undefined) {
                return reject(new Error(this.log().warn(`Fail to find tab's service`)));
            }
            const tab = service.getActiveTab();
            if (!service.has(uuid)) {
                const tab: ITab | undefined = this._available.get(uuid);
                if (tab === undefined) {
                    return reject(
                        new Error(this.log().warn(`Fail to find tab "${uuid}". Tab isn't added.`)),
                    );
                }
                service.add(tab);
            }
            if (openTabOnly === true) {
                if (tab !== undefined) {
                    service.setActive(tab.uuid);
                }
            } else {
                service.setActive(uuid);
            }
            resolve();
        });
    }

    private _onSessionChange(uuid: string | undefined) {
        if (uuid === undefined) {
            return;
        }
        if (this._sessions.has(uuid)) {
            // Service already exists
            return;
        }
        const service: TabsService = new TabsService();
        this._available.defaults().forEach((tab: ITab) => {
            service.add(tab);
        });
        this._sessions.set(uuid, service);
        this._active = uuid;
    }

    private _onSessionClosed(uuid: string) {
        const service: TabsService | undefined = this._sessions.get(uuid);
        if (service !== undefined) {
            service.destroy();
        }
        this._sessions.delete(uuid);
    }

    private _onViewChange(target: Declarations.AvailableSidebarTabs) {
        this._services.ui.layout.sidebar().max();
        switch (target) {
            case Declarations.AvailableSidebarTabs.SearchManager:
                this.setActive(UUIDs.search);
                break;
            case Declarations.AvailableSidebarTabs.CommentsManager:
                this.setActive(UUIDs.comments);
                break;
            case Declarations.AvailableSidebarTabs.Shell:
                this.setActive(UUIDs.shell);
                break;
            case Declarations.AvailableSidebarTabs.DLTConnector:
                this.setActive(UUIDs.dltdeamon);
                break;
            case Declarations.AvailableSidebarTabs.Concat:
                this.setActive(UUIDs.concat);
                break;
            case Declarations.AvailableSidebarTabs.Merge:
                this.setActive(UUIDs.merging);
                break;
        }
    }
}

export interface Service extends Interface {}
export const sidebar = register(new Service());
