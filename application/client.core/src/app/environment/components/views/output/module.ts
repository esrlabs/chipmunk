import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ViewRowModule } from '../row/module';
import { ViewOutputComponent } from './component';
import { ViewContentMapComponent } from './map/component';

import { ComplexModule, PrimitiveModule, ContainersModule } from 'chipmunk-client-material';

const entryComponents = [ViewOutputComponent, ViewContentMapComponent];
const components = [ViewOutputComponent, ...entryComponents];

@NgModule({
    entryComponents: [...entryComponents],
    imports: [
        CommonModule,
        ScrollingModule,
        PrimitiveModule,
        ContainersModule,
        ComplexModule,
        ViewRowModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class ViewOutputModule {
    constructor() {}
}
