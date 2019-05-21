import { NgModule } from '@angular/core';
import { InjectionOutputBottomComponent } from './views/injection.output.bottom/component';
import { SidebarVerticalComponent } from './views/sidebar.vertical/component';
import { CommonModule } from '@angular/common';
import { PrimitiveModule } from 'logviewer-client-primitive';

@NgModule({
    entryComponents: [InjectionOutputBottomComponent, SidebarVerticalComponent],
    declarations: [InjectionOutputBottomComponent, SidebarVerticalComponent],
    imports: [ CommonModule, PrimitiveModule ],
    exports: [InjectionOutputBottomComponent, SidebarVerticalComponent]
})

export class PluginModule {

    private _api: string | undefined;

    public setAPI(api: any) {
        this._api = api;
    }

}
