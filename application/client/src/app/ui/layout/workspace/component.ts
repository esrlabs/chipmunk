import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { TabsService } from '@elements/tabs/service';
import { LayoutWorkspaceNoContent } from './no-tabs-content/component';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';

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
}
export interface LayoutWorkspace extends IlcInterface {}
