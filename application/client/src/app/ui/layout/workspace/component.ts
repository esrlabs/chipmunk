import { Component, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { TabsService } from '@elements/tabs/service';
import { LayoutWorkspaceNoContent } from './no-tabs-content/component';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { components } from '@env/decorators/initial';

const WELCOME_TAB_UUID = 'welcome';

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
        this.ilc()
            .services.system.session.add()
            .unbound({
                uuid: WELCOME_TAB_UUID,
                sidebar: true,
                toolbar: false,
                tab: {
                    content: {
                        factory: LayoutWorkspaceNoContent,
                    },
                    active: true,
                    name: '',
                    closable: false,
                    icon: 'home',
                },
            })
            .sidebar()
            ?.add({
                content: {
                    factory: components.get('app-elements-tree'),
                },
                active: true,
                closable: false,
                name: 'Favourite',
            });
        this.env().subscriber.register(
            this.ilc().services.system.hotkeys.listen('Ctrl + Tab', () => {
                this.tabs.next();
            }),
        );
        this.env().subscriber.register(
            this.ilc().services.system.hotkeys.listen('Shift + Ctrl + Tab', () => {
                this.tabs.prev();
            }),
        );
        this.env().subscriber.register(
            this.ilc().services.system.hotkeys.listen('Ctrl + O', () => {
                this.tabs.setActive(WELCOME_TAB_UUID);
            }),
        );
    }
}
export interface LayoutWorkspace extends IlcInterface {}
