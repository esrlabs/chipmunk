import { NgModule } from '@angular/core';
import { SidebarVerticalComponent } from './views/sidebar.vertical/component';
import { CommonModule } from '@angular/common';
import { PrimitiveModule } from 'logviewer-client-primitive';

@NgModule({
    entryComponents: [SidebarVerticalComponent],
    declarations: [SidebarVerticalComponent],
    imports: [ CommonModule, PrimitiveModule ],
    exports: [SidebarVerticalComponent]
})

export class PluginModule {

    private _api: string | undefined;

    public setAPI(api: any) {
        this._api = api;
    }

}
