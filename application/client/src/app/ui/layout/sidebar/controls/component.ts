import { Component, Input, AfterContentInit, ChangeDetectorRef } from '@angular/core';
import { IMenuItem } from '@ui/service/contextmenu';
import { ITab } from '@elements/tabs/service';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';

@Component({
    selector: 'app-layout-sidebar-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class LayoutSidebarControls implements AfterContentInit {
    constructor(private _cdRef: ChangeDetectorRef) {}

    ngAfterContentInit() {}

    public _ng_onAdd(event: MouseEvent) {
        // const tabs: ITab[] | undefined = this.ilc().services.ui.sidebar.getNotOpened();
        // if (tabs === undefined || tabs.length === 0) {
        //     return;
        // }
        // const items: IMenuItem[] = tabs.map((tab: ITab) => {
        //     return {
        //         caption: tab.name,
        //         handler: () => {
        //             if (tab.guid === undefined) {
        //                 return;
        //             }
        //             // this.state.maximize();
        //             SidebarSessionsService.addByGuid(tab.guid);
        //         },
        //     };
        // });
        // this.ilc().services.ui.contextmenu.show({
        //     items: items,
        //     x: event.pageX,
        //     y: event.pageY,
        // });
        // event.stopImmediatePropagation();
        // event.preventDefault();
    }
}
export interface LayoutSidebarControls extends IlcInterface {}
