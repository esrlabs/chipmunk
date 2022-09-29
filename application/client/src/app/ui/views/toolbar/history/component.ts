import { Component, Input, AfterContentInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { IMenuItem, contextmenu } from '@ui/service/contextmenu';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { HistorySession, Suitable, SuitableGroup } from '@service/history/session';
import { Collections } from '@service/history/collections';
import { MatSelectChange } from '@angular/material/select';

import * as dom from '@ui/env/dom';

@Component({
    selector: 'app-views-history',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class History extends ChangesDetector implements AfterContentInit {
    @Input() session!: Session;

    public history!: HistorySession;
    public groups: SuitableGroup[] = [];
    public filters: { caption: string; value: number }[] = [];
    public show: number = -2;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    @HostListener('contextmenu', ['$event']) onContextMenu(event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption: `Remove All Presets`,
                handler: () => {
                    this.history.clear();
                    this.update().detectChanges();
                },
            },
            {},
            {
                caption: `Select all for export`,
                handler: () => {
                    //
                },
            },
            {
                caption: `Export all`,
                handler: () => {
                    //
                },
            },
        ];
        contextmenu.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        return dom.stop(event);
    }

    public onCollectionContextmenu(collection: Collections, event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption: `Remove`,
                handler: () => {
                    collection.delete();
                    this.update().detectChanges();
                },
            },
            {},
            {
                caption: `Select for export`,
                handler: () => {
                    //
                },
            },
            {
                caption: `Export to file`,
                handler: () => {
                    //
                },
            },
        ];
        contextmenu.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        return dom.stop(event);
    }

    public ngAfterContentInit(): void {
        const history = this.ilc().services.system.history.get(this.session);
        if (history === undefined) {
            this.log().error(`Fail to get history-session instance`);
            return;
        }
        this.history = history;
        history.subjects.get().suitable.subscribe((_collections: Suitable) => {
            this.list().update().detectChanges();
        });
        this.list().update();
    }

    public use(collection: Collections) {
        this.history.apply(collection);
    }

    public onListFilterChange(_event: MatSelectChange) {
        this.list().update().detectChanges();
    }

    protected update(): History {
        const groups: SuitableGroup[] = (() => {
            switch (this.show) {
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
        if (this.show < 0) {
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
        this.groups = this.groups.filter((g) => g.rank === this.show);
        return this;
    }

    protected list(): History {
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
export interface History extends IlcInterface {}
