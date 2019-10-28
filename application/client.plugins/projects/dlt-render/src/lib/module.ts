import { NgModule } from '@angular/core';
import { SidebarVerticalComponent } from './views/sidebar.vertical/component';
import * as Toolkit from 'chipmunk.client.toolkit';

import { CommonModule } from '@angular/common';

@NgModule({
    entryComponents: [ SidebarVerticalComponent ],
    declarations: [ SidebarVerticalComponent ],
    imports: [ CommonModule ],
    exports: [ SidebarVerticalComponent ],
})

export class PluginModule extends Toolkit.PluginNgModule {

    constructor() {
        super('DLT viewer', 'Show DLT entity details');
    }

}
