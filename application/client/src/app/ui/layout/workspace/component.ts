import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { TabsService } from '@elements/tabs/service';
import { AreaState } from '../state';
import { LayoutWorkspaceControls } from './controls/component';
import { LayoutWorkspaceNoContent } from './no-tabs-content/component';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
// import TabsSessionsService from '../../service/service.sessions.tabs';
// import RenderStateService from '../../service/service.render.state';
import { IDLTOptions, StatisticInfo, LevelDistribution, EMTIN } from '@platform/types/dlt';

@Component({
    selector: 'app-layout-workspace',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class LayoutWorkspace extends ChangesDetector implements AfterViewInit {
    public tabs: TabsService;
    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
        this.tabs = this.ilc().services.system.session.getTabsService();
        // Get reference to tab service
        // this.tabsService = TabsSessionsService.getTabsService();
        // Add controls to tab list area (button "+")
        // this.tabsService.updateOptions({
        //     injections: {
        //         bar: {
        //             factory: LayoutPrimiryAreaControlsComponent,
        //             inputs: {
        //                 onNewTab: this._onNewTab.bind(this),
        //             },
        //         },
        //     },
        //     noTabsContent: {
        //         factory: LayoutPrimiryAreaNoTabsComponent,
        //         inputs: {},
        //     },
        // });
        // // Create default session
        // TabsSessionsService.add()
        //     .then(() => {
        //         RenderStateService.state().ready();
        //     })
        //     .catch((error: Error) => {
        //         this.log().error(`Fail to create default tab due error: ${error.message}`);
        //     });
    }

    ngAfterViewInit() {
        this.tabs.add({
            content: {
                factory: LayoutWorkspaceNoContent,
            },
            active: true,
            name: 'Chipmunk',
        });
    }

    public _onTabsAreaClick() {}

    private _onMinimized(minimized: boolean) {
        this.detectChanges();
    }

    private _onUpdated(state: AreaState) {
        this.detectChanges();
    }

    public _onNewTab() {
        // TabsSessionsService.add().catch((error: Error) => {
        //     this.log().error(`Fail to open new tab due error: ${error.message}`);
        // });
    }
}
export interface LayoutWorkspace extends IlcInterface {}
