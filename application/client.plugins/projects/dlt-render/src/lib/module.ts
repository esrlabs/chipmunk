import { NgModule } from '@angular/core';
import { DLTRowComponent } from './views/row/component';
import { DLTColumnsComponent } from './views/columns/component';
import { SidebarVerticalComponent } from './views/sidebar.vertical/component';

import { CommonModule } from '@angular/common';

@NgModule({
    entryComponents: [ DLTRowComponent, DLTColumnsComponent, SidebarVerticalComponent ],
    declarations: [ DLTRowComponent, DLTColumnsComponent, SidebarVerticalComponent ],
    imports: [ CommonModule ],
    exports: [ DLTRowComponent, DLTColumnsComponent, SidebarVerticalComponent ]
})

export class PluginModule {

    private _api: string | undefined;

    public setAPI(api: any) {
        this._api = api;
    }

}
