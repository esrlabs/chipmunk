import { NgModule } from '@angular/core';
import { SidebarViewComponent } from './view/component';
import { CommonModule } from '@angular/common';
import { PrimitiveModule } from 'chipmunk-client-primitive';
import * as Toolkit from 'chipmunk.client.toolkit';

@NgModule({
    entryComponents: [SidebarViewComponent],
    declarations: [SidebarViewComponent],
    imports: [ CommonModule, PrimitiveModule ],
    exports: [SidebarViewComponent]
})


export class PluginModule extends Toolkit.PluginNgModule {

    constructor() {
        super('XTerminal', 'Show terminal');
    }

}
