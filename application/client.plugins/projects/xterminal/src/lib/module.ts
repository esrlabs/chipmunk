import { NgModule } from '@angular/core';
import { SidebarViewComponent } from './view/component';
import { CommonModule } from '@angular/common';
import { PrimitiveModule } from 'logviewer-client-primitive';

@NgModule({
    entryComponents: [SidebarViewComponent],
    declarations: [SidebarViewComponent],
    imports: [ CommonModule, PrimitiveModule ],
    exports: [SidebarViewComponent]
})

export class PluginModule {

    private _api: string | undefined;

    public setAPI(api: any) {
        this._api = api;
    }

}
