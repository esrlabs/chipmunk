import { unique } from '@platform/env/sequence';
import { TabsService, ITabAPI, ITab } from '@elements/tabs/service';
import { Base } from './base';

export class UnboundTab extends Base {
    private _sidebar: TabsService | undefined;
    private _toolbar: TabsService | undefined;

    private readonly _uuid: string;
    private _tab!: ITabAPI;

    public readonly tab: ITab;

    constructor(opts: { tab: ITab; sidebar?: boolean; toolbar?: boolean; uuid?: string }) {
        super();
        this._sidebar =
            opts.sidebar !== undefined ? (opts.sidebar ? new TabsService() : undefined) : undefined;
        this._toolbar =
            opts.toolbar !== undefined ? (opts.toolbar ? new TabsService() : undefined) : undefined;
        this._uuid = opts.uuid !== undefined ? opts.uuid : unique();
        this.tab = opts.tab;
    }

    public sidebar(): TabsService | undefined {
        return this._sidebar;
    }

    public toolbar(): TabsService | undefined {
        return this._toolbar;
    }

    public destroy(): Promise<void> {
        return Promise.resolve();
    }

    public bind(tab: ITabAPI) {
        this._tab = tab;
    }

    public uuid(): string {
        return this._uuid;
    }

    public isBound(): boolean {
        return false;
    }
}
