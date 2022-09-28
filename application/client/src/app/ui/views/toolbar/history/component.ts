import { Component, Input, AfterContentInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { IMenuItem, contextmenu } from '@ui/service/contextmenu';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { HistorySession, Suitable, SuitableGroup } from '@service/history/session';
import { Collections } from '@service/history/collections';

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

    @HostListener('contextmenu', ['$event']) onContextMenu(event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption: `Clear recent history`,
                handler: () => {
                    // this._session
                    //         .getSessionSearch()
                    //         .getStoreAPI()
                    //         .clear()
                    //         .catch((error: Error) => {
                    //             this._notifications.add({
                    //                 caption: 'Error',
                    //                 message: `Fail to drop recent filters history due error: ${error.message}`,
                    //             });
                    //         });
                },
            },
        ];
        contextmenu.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
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

    protected update(collections?: Suitable): void {
        const suitable = collections === undefined ? this.history.find().suitable() : collections;
        this.groups = suitable.asGroups();
    }
}
export interface History extends IlcInterface {}
