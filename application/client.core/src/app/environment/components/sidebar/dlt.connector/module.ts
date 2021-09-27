import { NgModule } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';

import { SidebarAppDLTConnectorComponent } from './component';
import { SidebarAppDLTConnectorMulticastComponent } from './multicast/component';

import { PrimitiveModule, ContainersModule } from 'chipmunk-client-material';
import { AppDirectiviesModule } from '../../../directives/module';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';

const entryComponents = [SidebarAppDLTConnectorComponent, SidebarAppDLTConnectorMulticastComponent];
const components = [...entryComponents];

@NgModule({
    entryComponents: [...entryComponents],
    imports: [
        CommonModule,
        PrimitiveModule,
        ContainersModule,
        DragDropModule,
        MatExpansionModule,
        MatInputModule,
        MatButtonModule,
        MatButtonToggleModule,
        MatDividerModule,
        FormsModule,
        ReactiveFormsModule,
        MatProgressBarModule,
        MatCheckboxModule,
        MatAutocompleteModule,
        AppDirectiviesModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class SidebarAppDLTConnectorModule {
    constructor() {}
}
