import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarVerticalComponent } from './views/sidebar.vertical/component';
import { PrimitiveModule } from 'logviewer-client-primitive';

@NgModule({
    entryComponents: [ SidebarVerticalComponent],
    declarations: [ SidebarVerticalComponent],
    imports: [ CommonModule, FormsModule, PrimitiveModule ],
    exports: [ SidebarVerticalComponent]
})

export class PluginModule {

    private _api: string | undefined;

    public setAPI(api: any) {
        this._api = api;
    }

}
