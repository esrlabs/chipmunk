import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppDirectiviesModule } from '../../../directives/module';
import { EnvironmentCommonModule } from '../../common/module';
import { PrimitiveModule, ContainersModule } from 'chipmunk-client-material';

import { ScrollIntoViewDirective } from './directives/scrollIntoView.directive';

import { SidebarAppAdbComponent } from './component';
import { SidebarAppAdbLogcatComponent } from './logcat/component';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

const entryComponents = [SidebarAppAdbComponent, SidebarAppAdbLogcatComponent];

const modules = [
    CommonModule,
    PrimitiveModule,
    ContainersModule,
    AppDirectiviesModule,
    EnvironmentCommonModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatInputModule,
    FormsModule,
    ReactiveFormsModule,
];

const directives = [ScrollIntoViewDirective];

@NgModule({
    entryComponents: [...entryComponents],
    imports: [...modules],
    declarations: [...entryComponents, ...directives],
    exports: [...entryComponents, ...directives],
})
export class SidebarAppAdbModule {
    constructor() {}
}
