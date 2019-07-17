import { NgModule } from '@angular/core';
import { SidebarVerticalComponent } from './views/sidebar.vertical/component';

import { CommonModule } from '@angular/common';

@NgModule({
    entryComponents: [ SidebarVerticalComponent ],
    declarations: [ SidebarVerticalComponent ],
    imports: [ CommonModule ],
    exports: [ SidebarVerticalComponent ]
})

export class PluginModule {

    private _api: string | undefined;

    public setAPI(api: any) {
        this._api = api;
    }

}
