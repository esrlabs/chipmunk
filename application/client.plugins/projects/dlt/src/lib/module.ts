import { NgModule } from '@angular/core';
import { SidebarVerticalComponent } from './views/sidebar.vertical/component';
import { CommonModule } from '@angular/common';
import { PrimitiveModule } from 'logviewer-client-primitive';
import * as Toolkit from 'logviewer.client.toolkit';

@NgModule({
    entryComponents: [ SidebarVerticalComponent],
    declarations: [ SidebarVerticalComponent],
    imports: [ CommonModule, PrimitiveModule ],
    exports: [ SidebarVerticalComponent]
})

export class PluginModule extends Toolkit.PluginNgModule {

    constructor() {
        super('DLT tcp', 'Conenctor to DLT tcp demon');
    }

}
