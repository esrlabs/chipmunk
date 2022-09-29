import { Component, Input, AfterContentInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { IMenuItem, contextmenu } from '@ui/service/contextmenu';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Collections } from '@service/history/collections';
import { MatSelectChange } from '@angular/material/select';
import { State } from './state';

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

    public state: State = new State();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    @HostListener('contextmenu', ['$event']) onContextMenu(event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption: `Remove All Presets`,
                handler: () => {
                    this.state.history.clear();
                    this.state.update();
                    this.detectChanges();
                },
            },
            {},
            {
                caption: `Export all`,
                handler: () => {
                    this.state.selection().all().export();
                },
            },
            {},
            {
                caption: `Import from file`,
                handler: () => {
                    this.state.import();
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
                    this.state.update();
                    this.detectChanges();
                },
            },
            {},
            {
                caption: `Select for export`,
                handler: () => {
                    this.state.selection().select(collection);
                    this.detectChanges();
                },
            },
            {},
            {
                caption: `Import from file`,
                handler: () => {
                    this.state.import();
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
        this.state.init(this, this.session);
    }

    public use(collection: Collections) {
        this.state.history.apply(collection);
    }

    public onListFilterChange(_event: MatSelectChange) {
        this.state.list().update();
        this.detectChanges();
    }
}
export interface History extends IlcInterface {}
