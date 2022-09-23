import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { ui } from '@register/services';
import { ilc, Emitter, Channel, Declarations, Services } from '@service/ilc';
import { IComponentDesc } from '@elements/containers/dynamic/component';
import { unique } from '@platform/env/sequence';

import { TabsService, ITab } from '@elements/tabs/service';
import { UUIDs } from './toolbar/register';
import { Tabs } from './toolbar/tabs';

@SetupService(ui['toolbar'])
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
        this._channel.ux.hotkey(this._onHotKey.bind(this));
        this._channel.session.change(this._onSessionChange.bind(this));
        this._channel.session.closed(this._onSessionClosed.bind(this));
        this._channel.ui.toolbar.view(this._onViewChange.bind(this));
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

    public add(name: string, content: IComponentDesc, uuid?: string): string | undefined {
        if (this._active === undefined) {
            return undefined;
        }
        const service: TabsService | undefined = this._sessions.get(this._active);
        if (service === undefined) {
            return undefined;
        }
        uuid = typeof uuid !== 'string' ? unique() : uuid;
        if (!service.has(uuid)) {
            service.add({
                uuid: uuid,
                name,
                active: true,
                content,
            });
        }
        this._sessions.set(this._active, service);
        return uuid;
    }

    public addByGuid(uuid: string): void {
        if (this._active === undefined) {
            return undefined;
        }
        const tab: ITab | undefined = this._available.get(uuid);
        const service: TabsService | undefined = this._sessions.get(this._active);
        if (service === undefined || tab === undefined) {
            return undefined;
        }
        service.add(tab);
    }

    public remove(uuid: string): void {
        if (this._active === undefined) {
            return undefined;
        }
        const service: TabsService | undefined = this._sessions.get(this._active);
        if (service === undefined) {
            return undefined;
        }
        service.remove(uuid);
        this._sessions.set(this._active, service);
    }

    public has(uuid: string): boolean {
        if (this._active === undefined) {
            return false;
        }
        const service: TabsService | undefined = this._sessions.get(this._active);
        if (service === undefined) {
            return false;
        }
        return service.has(uuid);
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

    public getInactiveTabs(session?: string): ITab[] | undefined {
        session = session === undefined ? this._active : session;
        if (session === undefined) {
            return undefined;
        }
        const service: TabsService | undefined = this._sessions.get(session);
        if (service === undefined) {
            return undefined;
        }
        return this._available.all().filter((tab: ITab) => {
            return tab.uuid === undefined ? false : !service.has(tab.uuid);
        });
    }

    private _onHotKey(event: Declarations.HotkeyEvent) {
        console.log(`Not implemented: ${event}`);
        // if (this._active === undefined) {
        //     return;
        // }
        // const service: TabsService | undefined = this._sessions.get(this._active);
        // if (service === undefined) {
        //     return;
        // }
        // LayoutStateService.toolbarMax();
        // service.setActive(UUIDs.search);
    }

    private _onSessionClosed(session: string) {
        const service: TabsService | undefined = this._sessions.get(session);
        if (service === undefined) {
            return;
        }
        service.destroy();
        this._sessions.delete(session);
        if (this._active === session) {
            this._active = undefined;
        }
    }

    private _onSessionChange(uuid: string | undefined) {
        if (uuid === undefined) {
            return;
        }
        let service: TabsService | undefined = this._sessions.get(uuid);
        if (service === undefined) {
            service = new TabsService({ uuid: `toolbar: ${uuid}` });
            this._available.all().map((tab: ITab) => {
                if (tab.uuid !== undefined && !this._available.visible(tab.uuid)) {
                    return;
                }
                service !== undefined && service.unshift(tab);
            });
            this._sessions.set(uuid, service);
        }
        this._active = uuid;
    }

    private _onViewChange(target: Declarations.AvailableToolbarTabs) {
        if (this._active === undefined) {
            return;
        }
        this._services.ui.layout.toolbar().max();
        switch (target) {
            case Declarations.AvailableToolbarTabs.Search:
                this.addByGuid(UUIDs.search);
                break;
            case Declarations.AvailableToolbarTabs.Charts:
                this.addByGuid(UUIDs.charts);
                break;
            case Declarations.AvailableToolbarTabs.TimeMeasurement:
                this.addByGuid(UUIDs.timemeasurement);
                break;
            case Declarations.AvailableToolbarTabs.Notifications:
                this.addByGuid(UUIDs.notification);
                break;
        }
    }
}
export interface Service extends Interface {}
export const toolbar = register(new Service());
