import { NgModule } from '@angular/core';
import { SidebarVerticalComponent } from './views/sidebar.vertical/component';
import { TaskbarStateComponent } from './views/taskbar.state/component';
import { CommonModule } from '@angular/common';
import { PrimitiveModule } from 'logviewer-client-primitive';

@NgModule({
    entryComponents: [TaskbarStateComponent, SidebarVerticalComponent],
    declarations: [TaskbarStateComponent, SidebarVerticalComponent],
    imports: [ CommonModule, PrimitiveModule ],
    exports: [TaskbarStateComponent, SidebarVerticalComponent]
})

export class PluginModule {

    private _api: string | undefined;

    public setAPI(api: any) {
        this._api = api;
    }

}
