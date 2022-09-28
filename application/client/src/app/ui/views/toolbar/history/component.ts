import { Component, Input, AfterContentInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { IMenuItem, contextmenu } from '@ui/service/contextmenu';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { HistorySession, Suitable, SuitableGroup } from '@service/history/session';
import { Collections } from '@service/history/collections';

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
        history.subjects.get().suitable.subscribe((collections: Suitable) => {
            this.update(collections);
            this.detectChanges();
        });
        this.update();
    }

    public use(collection: Collections) {
        this.history.apply(collection);
    }

    protected update(collections?: Suitable): History {
        const suitable = collections === undefined ? this.history.find().suitable() : collections;
        this.groups = suitable.asGroups();
        return this;
    }
}
export interface History extends IlcInterface {}
