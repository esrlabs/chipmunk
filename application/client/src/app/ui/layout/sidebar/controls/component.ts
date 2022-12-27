import { Component, ChangeDetectorRef } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';

@Component({
    selector: 'app-layout-sidebar-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class LayoutSidebarControls {
    constructor(private _cdRef: ChangeDetectorRef) {}

    public _ng_onAdd(event: MouseEvent) {
        console.log(event);
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
    }
}
export interface LayoutSidebarControls extends IlcInterface {}
