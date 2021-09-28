import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';

import { ViewOutputRowComponent } from './component';
import { ViewOutputRowStandardComponent } from './standard/component';
import { ViewOutputRowExternalComponent } from './external/component';
import { ViewOutputRowColumnsComponent } from './columns/component';
import { ViewOutputRowColumnsHeadersComponent } from './columns/headers/component';
import { ViewOutputRowColumnsHeadersMenuComponent } from './columns/headers/menu/component';

import { ComplexModule, PrimitiveModule, ContainersModule } from 'chipmunk-client-material';

const rows = [
    ViewOutputRowStandardComponent,
    ViewOutputRowExternalComponent,
    ViewOutputRowColumnsComponent,
    ViewOutputRowColumnsHeadersComponent,
    ViewOutputRowColumnsHeadersMenuComponent,
];
const entryComponents = [ViewOutputRowComponent, ...rows];
const components = [...entryComponents];

@NgModule({
    entryComponents: [...entryComponents],
    imports: [
        CommonModule,
        ScrollingModule,
        PrimitiveModule,
        ContainersModule,
        ComplexModule,
        MatIconModule,
        MatCheckboxModule,
        MatButtonModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class ViewRowModule {
    constructor() {}
}
