import { NgModule } from '@angular/core';
import { SidebarVerticalComponent } from './views/sidebar.vertical/component';
import { CommonModule } from '@angular/common';
import { PrimitiveModule } from 'chipmunk-client-material';
import * as Toolkit from 'chipmunk.client.toolkit';

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
