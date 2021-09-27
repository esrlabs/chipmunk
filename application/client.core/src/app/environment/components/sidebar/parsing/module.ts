import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SidebarAppParsingComponent } from './component';

import { PrimitiveModule, ContainersModule } from 'chipmunk-client-material';

const entryComponents = [SidebarAppParsingComponent];
const components = [...entryComponents];

@NgModule({
    entryComponents: [...entryComponents],
    imports: [CommonModule, PrimitiveModule, ContainersModule],
    declarations: [...components],
    exports: [...components],
})
export class SidebarAppParsingModule {
    constructor() {}
}
