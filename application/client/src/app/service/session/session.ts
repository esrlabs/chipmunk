import { TabsService, ITabAPI, ETabsListDirection, TabsOptions } from '@elements/tabs/service';
import { Storage } from '@env/storage';
import { Stream } from './dependencies/stream';
import { Search } from './dependencies/search';
import { Charts } from './dependencies/charts';
import { Indexed } from './dependencies/indexed';
import { Cursor } from './dependencies/cursor';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { cutUuid } from '@log/index';
import { Render } from '@schema/render';
import { components } from '@env/decorators/initial';
import { Base } from './base';
import { Bookmarks } from './dependencies/bookmarks';
import { Comments } from './dependencies/comments';
import { Exporter } from './dependencies/exporter';
import { IRange, fromIndexes } from '@platform/types/range';
import { Providers } from './dependencies/observing/providers';
import { Attachments } from './dependencies/attachments';
import { Info } from './dependencies/info';
import { session } from '@service/session';
import { Highlights } from './dependencies/search/highlights';
import { TeamWork } from './dependencies/teamwork';
import { Cli } from './dependencies/cli';
import { FilterRequest } from './dependencies/search/filters/request';
import { ChartRequest } from './dependencies/search/charts/request';
import { DisabledRequest } from './dependencies/search/disabled/request';
import { StoredEntity } from './dependencies/search/store';
import { Notification, notifications } from '@ui/service/notifications';
import { error } from '@platform/log/utils';

import * as ids from '@schema/ids';
import * as Requests from '@platform/ipc/request';
import * as Origins from '@platform/types/observe/origin/index';
import * as Factory from '@platform/types/observe/factory';
import * as Parsers from '@platform/types/observe/parser/index';
import * as Types from '@platform/types/observe/types/index';

export { Stream };

interface Snap {
    filters: string[];
    charts: string[];
    disabled: string[];
}

@SetupLogger()
export class Session extends Base {
    public readonly storage: Storage = new Storage();
    public readonly stream: Stream = new Stream();
    public readonly search: Search = new Search();
    public readonly charts: Charts = new Charts();
    public readonly indexed: Indexed = new Indexed();
    public readonly bookmarks: Bookmarks = new Bookmarks();
    public readonly comments: Comments = new Comments();
    public readonly cursor: Cursor = new Cursor();
    public readonly highlights: Highlights = new Highlights();
    public readonly exporter: Exporter = new Exporter();
    public readonly render: Render<unknown>;
    public readonly observed: Providers = new Providers();
    public readonly attachments: Attachments = new Attachments();
    public readonly info: Info = new Info();
    public readonly teamwork: TeamWork = new TeamWork();
    public readonly cli: Cli = new Cli();

    private _uuid!: string;
    private _tab!: ITabAPI;
    private readonly _toolbar: TabsService = new TabsService();
    private readonly _sidebar: TabsService = new TabsService({
        options: new TabsOptions({ direction: ETabsListDirection.left }),
    });
    protected inited: boolean = false;

    constructor(render: Render<unknown>) {
        super();
        this.render = render;
        this._toolbar.add({
            uuid: ids.TOOLBAR_TAB_SEARCH,
            name: 'Search',
            active: true,
            closable: false,
            uppercaseTitle: true,
            content: {
                factory: components.get('app-views-search'),
                inputs: {
                    session: this,
                },
            },
        });
        this._toolbar.add({
            uuid: ids.TOOLBAR_TAB_DETAILS,
            name: 'Details',
            active: false,
            closable: false,
            uppercaseTitle: true,
            content: {
                factory: components.get('app-views-details'),
                inputs: {
                    session: this,
                },
            },
        });
        this._toolbar.add({
            uuid: ids.TOOLBAR_TAB_PRESET,
            name: 'Presets / History',
            active: false,
            closable: false,
            uppercaseTitle: true,
            content: {
                factory: components.get('app-views-history'),
                inputs: {
                    session: this,
                },
            },
        });
        this._toolbar.add({
            uuid: ids.TOOLBAR_TAB_CHART,
            name: 'Chart',
            active: false,
            closable: false,
            uppercaseTitle: true,
            content: {
                factory: components.get('app-views-chart'),
                inputs: {
                    session: this,
                },
            },
        });
        this._sidebar.add({
            uuid: ids.SIDEBAR_TAB_OBSERVING,
            name: 'Observing',
            active: false,
            closable: false,
            uppercaseTitle: true,
            content: {
                factory: components.get('app-views-observe-list'),
                inputs: {
                    session: this,
                },
            },
        });
        this._sidebar.add({
            uuid: ids.SIDEBAR_TAB_ATTACHMENTS,
            name: 'Attachments',
            active: false,
            closable: false,
            uppercaseTitle: true,
            content: {
                factory: components.get('app-views-attachments-list'),
                inputs: {
                    session: this,
                },
            },
        });
        this._sidebar.add({
            uuid: ids.SIDEBAR_TAB_FILTERS,
            name: 'Filters',
            active: true,
            closable: false,
            uppercaseTitle: true,
            content: {
                factory: components.get('app-views-filters'),
                inputs: {
                    session: this,
                },
            },
        });
        this._sidebar.add({
            uuid: ids.SIDEBAR_TAB_COMMENTS,
            name: 'Comments',
            active: false,
            closable: false,
            uppercaseTitle: true,
            content: {
                factory: components.get('app-views-comments'),
                inputs: {
                    session: this,
                },
            },
        });
        this._sidebar.add({
            uuid: ids.SIDEBAR_TAB_TEAMWORK,
            name: 'Teamwork',
            active: false,
            closable: false,
            uppercaseTitle: true,
            content: {
                factory: components.get('app-views-teamwork'),
                inputs: {
                    session: this,
                },
            },
        });
    }

    public init(): Promise<string> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send<Requests.Session.Create.Response>(
                Requests.Session.Create.Response,
                new Requests.Session.Create.Request({}),
            )
                .then((response) => {
                    this.setLoggerName(`Session: ${cutUuid(response.uuid)}`);
                    this._uuid = response.uuid;
                    this.stream.init(this._uuid, this.info);
                    this.cursor.init(this._uuid);
                    this.indexed.init(this._uuid);
                    this.bookmarks.init(this._uuid, this.stream, this.cursor);
                    this.comments.init(this);
                    this.search.init(this);
                    this.exporter.init(this._uuid, this.stream, this.indexed);
                    this.observed.init(this);
                    this.attachments.init(this._uuid);
                    this.charts.init(this._uuid, this.stream, this.search);
                    this.highlights.init(this);
                    this.teamwork.init(this);
                    this.cli.init(this);
                    this.inited = true;
                    resolve(this._uuid);
                })
                .catch(reject);
        });
    }

    public destroy(): Promise<void> {
        this.highlights.destroy();
        this.storage.destroy();
        this.search.destroy();
        this.indexed.destroy();
        this.stream.destroy();
        this.bookmarks.destroy();
        this.comments.destroy();
        this.cursor.destroy();
        this.exporter.destroy();
        this.observed.destroy();
        this.attachments.destroy();
        this.charts.destroy();
        this.info.destroy();
        this.teamwork.destroy();
        this.cli.destroy();
        this.unsubscribe();
        if (!this.inited) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            Requests.IpcRequest.send<Requests.Session.Destroy.Response>(
                Requests.Session.Destroy.Response,
                new Requests.Session.Destroy.Request({ session: this.uuid() }),
            )
                .then((response) => {
                    if (response.error !== undefined) {
                        this.log().error(`Error on destroying session: ${response.error}`);
                    }
                    resolve();
                })
                .catch((err: Error) => {
                    this.log().error(`Error on sending destroy session reques: ${err.message}`);
                    resolve();
                });
        });
    }

    public bind(tab: ITabAPI) {
        this._tab = tab;
    }

    public uuid(): string {
        return this._uuid;
    }

    public sidebar(): TabsService | undefined {
        return this._sidebar;
    }

    public toolbar(): TabsService | undefined {
        return this._toolbar;
    }

    public switch(): {
        toolbar: {
            search(): void;
            presets(): void;
            details(): void;
            charts(): void;
        };
        sidebar: {
            comments(): void;
            filters(): void;
            attachments(): void;
            observing(): void;
            teamwork(): void;
        };
    } {
        return {
            toolbar: {
                search: (): void => {
                    this._toolbar.setActive(ids.TOOLBAR_TAB_SEARCH);
                },
                presets: (): void => {
                    this._toolbar.setActive(ids.TOOLBAR_TAB_PRESET);
                },
                details: (): void => {
                    this._toolbar.setActive(ids.TOOLBAR_TAB_DETAILS);
                },
                charts: (): void => {
                    this._toolbar.setActive(ids.TOOLBAR_TAB_CHART);
                },
            },
            sidebar: {
                comments: (): void => {
                    this._sidebar.setActive(ids.SIDEBAR_TAB_COMMENTS);
                },
                filters: (): void => {
                    this._sidebar.setActive(ids.SIDEBAR_TAB_FILTERS);
                },
                observing: (): void => {
                    this._sidebar.setActive(ids.SIDEBAR_TAB_OBSERVING);
                },
                attachments: (): void => {
                    this._sidebar.setActive(ids.SIDEBAR_TAB_ATTACHMENTS);
                },
                teamwork: (): void => {
                    this._sidebar.setActive(ids.SIDEBAR_TAB_TEAMWORK);
                },
            },
        };
    }

    public isBound(): boolean {
        return true;
    }

    public close(): void {
        this._tab.close();
    }

    public selection(): {
        indexes(): number[];
        ranges(): IRange[];
    } {
        return {
            indexes: (): number[] => {
                const selected = this.cursor.get().slice();
                selected.sort((a, b) => (a > b ? 1 : -1));
                return selected;
            },
            ranges: (): IRange[] => {
                return fromIndexes(this.selection().indexes());
            },
        };
    }

    public title(): {
        set(title: string): Error | undefined;
        get(): Error | string;
    } {
        return {
            set: (title: string): Error | undefined => {
                return this._tab.setTitle(title);
            },
            get: (): Error | string => {
                return this._tab.getTitle();
            },
        };
    }

    public snap(): {
        get(): string;
        load(json: string): Error | undefined;
    } {
        return {
            get: (): string => {
                const snap: Snap = {
                    filters: this.search
                        .store()
                        .filters()
                        .get()
                        .map((v) => v.json().to()),
                    disabled: this.search
                        .store()
                        .disabled()
                        .get()
                        .map((v) => v.json().to()),
                    charts: this.search
                        .store()
                        .charts()
                        .get()
                        .map((v) => v.json().to()),
                };
                return JSON.stringify(snap);
            },
            load: (json: string): Error | undefined => {
                try {
                    const snap: Snap = JSON.parse(json);
                    if (snap.filters === undefined) {
                        throw new Error(`No filters list`);
                    }
                    if (snap.disabled === undefined) {
                        throw new Error(`No disabled list`);
                    }
                    if (snap.charts === undefined) {
                        throw new Error(`No charts list`);
                    }
                    const warnings: string[] = [];
                    const check = (v: FilterRequest | DisabledRequest | ChartRequest | Error) => {
                        if (!(v instanceof Error)) {
                            return true;
                        } else {
                            warnings.push(v.message);
                            return false;
                        }
                    };
                    const filters = snap.filters
                        .map((json) => FilterRequest.fromJson(json))
                        .filter((v) => check(v)) as FilterRequest[];
                    const charts = snap.charts
                        .map((json) => ChartRequest.fromJson(json))
                        .filter((v) => check(v)) as ChartRequest[];
                    const disabled = snap.disabled
                        .map((json) => DisabledRequest.fromJson(json))
                        .filter((v) => check(v)) as DisabledRequest[];
                    this.search
                        .store()
                        .filters()
                        .overwrite(filters as StoredEntity<FilterRequest>[]);
                    this.search
                        .store()
                        .charts()
                        .overwrite(charts as StoredEntity<ChartRequest>[]);
                    this.search
                        .store()
                        .disabled()
                        .overwrite(disabled as StoredEntity<DisabledRequest>[]);
                    if (warnings.length > 0) {
                        notifications.notify(
                            new Notification({
                                message: `Some filters/charts weren't imported: ${warnings.join(
                                    '; ',
                                )}`,
                                actions: [],
                            }),
                        );
                    }
                    return undefined;
                } catch (err) {
                    return new Error(`Fail to parse session snap file: ${error(err)}`);
                }
            },
        };
    }

    public getTabAPI(): ITabAPI {
        return this._tab;
    }

    public async searchResultAsNewSession(): Promise<void> {
        const filepath: string | undefined = await this.exporter.clone();
        if (filepath === undefined) {
            return;
        }
        const sources = this.stream.observe().sources();
        if (sources.length === 0) {
            throw new Error(`Fail to find bound source`);
        }
        const current = sources[0].observe.clone();
        const parentSearchStore = this.search.store();
        const observe = (() => {
            const file = current.origin.as<Origins.File.Configuration>(Origins.File.Configuration);
            const concat = current.origin.as<Origins.Concat.Configuration>(
                Origins.Concat.Configuration,
            );
            if (file !== undefined) {
                file.set().filename(filepath);
                return current;
            } else if (concat !== undefined) {
                if (concat.filetypes().length === 0) {
                    throw new Error(`Cannot find type of concated files`);
                }
                return new Factory.File().type(concat.filetypes()[0]).file(filepath).asDlt().get();
            } else {
                const observe = new Factory.File()
                    .type(
                        (() => {
                            switch (current.parser.alias()) {
                                case Parsers.Protocol.Text:
                                    return Types.File.FileType.Text;
                                case Parsers.Protocol.Dlt:
                                case Parsers.Protocol.SomeIp:
                                    throw new Error(
                                        `Exporting from none-text streams to create new session aren't supported yet`,
                                    );
                            }
                        })(),
                    )
                    .file(filepath)
                    .asText()
                    .get();
                observe.parser.overwrite(current.parser.configuration);
                return observe;
            }
        })();
        return session
            .initialize()
            .observe(observe)
            .then((uuid: string) => {
                const created = session.get(uuid);
                if (created === undefined) {
                    this.log().error(`Fail to find created session ${uuid}`);
                    return;
                }
                created.search.store().filters().overwrite(parentSearchStore.filters().get());
                created.search.store().charts().overwrite(parentSearchStore.charts().get());
                created.search.store().disabled().overwrite(parentSearchStore.disabled().get());
            });
    }
}
export interface Session extends LoggerInterface {}
