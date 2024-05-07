import { HistorySession, SuitableGroup, Suitable } from '@service/history/session';
import { IlcInterface } from '@env/decorators/component';
import { Session } from '@service/session';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Collections } from '@service/history/collections';
import { notifications, Notification } from '@ui/service/notifications';

export interface Selection {
    select(collection: Collections): Selection;
    has(): boolean;
    export(): Selection;
    all(): Selection;
    drop(): Selection;
}

export class State {
    protected parent!: IlcInterface & ChangesDetector;

    public history!: HistorySession;
    public groups: SuitableGroup[] = [];
    public filters: { caption: string; value: number }[] = [];
    public filtered: number = -2;
    public session!: Session;
    public selected: { [key: string]: boolean } = {};

    public init(parent: IlcInterface & ChangesDetector, session: Session) {
        this.parent = parent;
        this.session = session;
        const history = this.parent.ilc().services.system.history.get(this.session);
        if (history === undefined) {
            this.parent.log().error(`Fail to get history-session instance`);
            return;
        }
        this.history = history;
        history.subjects.get().suitable.subscribe((_collections: Suitable) => {
            this.list().update();
            this.parent.detectChanges();
        });
        this.list().update();
    }

    public selection(): Selection {
        const self = {
            select: (collection: Collections): Selection => {
                this.selected[collection.uuid] = true;
                return self;
            },
            has: (): boolean => {
                return Object.keys(this.selected).filter((k) => this.selected[k]).length > 0;
            },
            export: (): Selection => {
                this.parent
                    .ilc()
                    .services.system.bridge.files()
                    .select.save()
                    .then((filename: string | undefined) => {
                        if (filename === undefined) {
                            return;
                        }
                        this.parent
                            .ilc()
                            .services.system.history.export(
                                Object.keys(this.selected)
                                    .map((k) => (this.selected[k] ? k : undefined))
                                    .filter((u) => u !== undefined) as string[],
                                filename,
                            )
                            .then(() => {
                                this.selection().drop();
                            })
                            .catch((err: Error) => {
                                this.parent.log().error(`Fail to export: ${err.message}`);
                            });
                    })
                    .catch((err: Error) => {
                        this.parent.log().error(`Fail to export: ${err.message}`);
                    });
                return self;
            },
            all: (): Selection => {
                this.groups.forEach((group) => {
                    group.collections.forEach((col) => {
                        this.selected[col.uuid] = true;
                    });
                });
                this.parent.detectChanges();
                return self;
            },
            drop: (): Selection => {
                Object.keys(this.selected).forEach((k) => (this.selected[k] = false));
                this.parent.detectChanges();
                return self;
            },
        };
        return self;
    }

    public import(): void {
        this.parent
            .ilc()
            .services.system.bridge.files()
            .select.any()
            .then((files) => {
                if (files.length !== 1) {
                    return;
                }
                this.parent
                    .ilc()
                    .services.system.history.import(files[0].filename)
                    .then(() => {
                        this.list().update();
                        this.parent.detectChanges();
                    })
                    .catch((err: Error) => {
                        notifications.notify(
                            new Notification({
                                message: this.parent
                                    .log()
                                    .error(`Fail import filters/charts: ${err.message}`),
                                session: this.session.uuid(),
                                actions: [],
                            }),
                        );
                    });
            })
            .catch((err: Error) => {
                notifications.notify(
                    new Notification({
                        message: this.parent
                            .log()
                            .error(`Fail open file to import filters/charts: ${err.message}`),
                        session: this.session.uuid(),
                        actions: [],
                    }),
                );
            });
    }

    public update(): State {
        const groups: SuitableGroup[] = (() => {
            switch (this.filtered) {
                case -3:
                    return [{ caption: 'All', rank: 0, collections: this.history.find().all() }];
                case -2:
                    return this.history.find().suitable().asGroups();
                case -1:
                    return [
                        {
                            caption: 'All Named Presets',
                            rank: 0,
                            collections: this.history.find().named(),
                        },
                    ];
                default:
                    return this.history.find().suitable().asGroups();
            }
        })();
        if (this.filtered < 0) {
            this.groups = groups;
            return this;
        }
        const unnamed: SuitableGroup = { caption: 'Unnamed group', rank: 1000, collections: [] };
        this.groups = [];
        groups.forEach((group) => {
            if (group.caption !== undefined) {
                this.groups.push(group);
            } else {
                unnamed.collections = unnamed.collections.concat(group.collections);
            }
        });
        if (unnamed.collections.length > 0) {
            this.groups.push(unnamed);
        }
        this.groups = this.groups.filter((g) => g.rank === this.filtered);
        this.selected = {};
        this.groups.forEach((group) => {
            group.collections.forEach((col) => {
                this.selected[col.uuid] = false;
            });
        });
        return this;
    }

    public list(): State {
        const suitable = this.history.find().suitable();
        const groups = suitable.asGroups();
        this.filters = [
            { caption: 'All', value: -3 },
            { caption: 'All Suitable', value: -2 },
            { caption: 'Named Presets', value: -1 },
        ];
        const unnamed: SuitableGroup = { caption: 'Unnamed group', rank: 1000, collections: [] };
        groups.forEach((group) => {
            if (group.caption !== undefined) {
                this.filters.push({ caption: group.caption, value: group.rank });
            } else {
                unnamed.collections = unnamed.collections.concat(group.collections);
            }
        });
        if (unnamed.collections.length > 0) {
            this.filters.push({ caption: 'Unnamed group', value: 1000 });
        }
        return this;
    }
}
