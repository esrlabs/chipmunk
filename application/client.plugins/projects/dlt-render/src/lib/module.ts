import { NgModule } from '@angular/core';
import { DLTRowComponent } from './views/row/component';
import { SidebarVerticalComponent } from './views/sidebar.vertical/component';

import { CommonModule } from '@angular/common';

@NgModule({
    entryComponents: [ DLTRowComponent, SidebarVerticalComponent ],
    declarations: [ DLTRowComponent, SidebarVerticalComponent],
    imports: [ CommonModule ],
    exports: [ DLTRowComponent, SidebarVerticalComponent]
})

export class PluginModule {

    private _api: string | undefined;

    public setAPI(api: any) {
        this._api = api;
    }

}
