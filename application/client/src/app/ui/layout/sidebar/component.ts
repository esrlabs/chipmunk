import { Component, Input, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { TabsService } from '@elements/tabs/service';
import { Session } from '@service/session';
import { AreaState } from '../state';
import { LayoutSidebarControls } from './controls/component';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';

@Component({
    selector: 'app-layout-sidebar',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class LayoutSidebar implements AfterViewInit {
    @Input() public state!: AreaState;

    public _ng_tabsService: TabsService | undefined;

    constructor(private _cdRef: ChangeDetectorRef) {}

    ngAfterViewInit() {
        if (!this.state) {
            return;
        }
        // // Subscribe to change of current session
        // this._subscriptions.onSessionChange =
        //     EventsSessionService.getObservable().onSessionChange.subscribe(
        //         this._onSessionChange.bind(this),
        //     );
        // // Subscribe to state events
        // this._subscriptions.minimized = this.state
        //     .getObservable()
        //     .minimized.subscribe(this._onMinimized.bind(this));
        // this._subscriptions.updated = this.state
        //     .getObservable()
        //     .updated.subscribe(this._onUpdated.bind(this));
        // // Get tabs service
        // this._setActiveTabsService();
        // // Update layout
        // this._cdRef.detectChanges();
    }

    public _ng_onTabsAreaClick() {
        if (!this.state.minimized) {
            return;
        }
        this.state.maximize();
    }

    private _onMinimized(minimized: boolean) {
        this._cdRef.detectChanges();
    }

    private _onUpdated(state: AreaState) {
        this._cdRef.detectChanges();
    }

    private _onSessionChange(session: Session | undefined) {
        this._setActiveTabsService(session);
    }

    private _setActiveTabsService(session?: Session | undefined) {
        if (session === undefined || session === null) {
            session = this.ilc().services.system.session.active();
        }
        this._ng_tabsService = undefined;
        // if (session !== undefined ) {
        //     // Get tabs service
        //     const service: TabsService | undefined = SidebarSessionsService.getTabsService(
        //         session.getGuid(),
        //     );
        //     if (service !== undefined) {
        //         this._ng_tabsService = service;
        //         // Change layout of tabs in sidebar
        //         this._ng_tabsService.setOptions(
        //             new TabsOptions({
        //                 injections: {
        //                     bar: {
        //                         factory: LayoutSessionSidebarControlsComponent,
        //                         inputs: {
        //                             state: this.state,
        //                         },
        //                     },
        //                 },
        //                 direction: ETabsListDirection.left,
        //                 minimized: true,
        //             }),
        //         );
        //     } else {
        //         this.log().warn(`Fail to init sidebar because no tab's service available.`);
        //     }
        // }
        this._cdRef.detectChanges();
    }
}
export interface LayoutSidebar extends IlcInterface {}
