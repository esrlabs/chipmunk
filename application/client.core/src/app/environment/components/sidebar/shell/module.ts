import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppDirectiviesModule } from '../../../directives/module';
import { EnvironmentCommonModule } from '../../common/module';
import { PrimitiveModule, ContainersModule } from 'chipmunk-client-material';
import { FocusInputDirective } from './directives/focus.input.directive';

import { SidebarAppShellComponent } from './component';
import { SidebarAppShellInputComponent } from './input/component';
import { SidebarAppShellRunningComponent } from './running/component';
import { SidebarAppShellEnvironmentVariablesComponent } from './environment/environment_variables/component';
import { SidebarAppShellTerminatedComponent } from './terminated/component';
import { SidebarAppShellPresetComponent } from './environment/preset/component';
import { SidebarAppShellEnvironmentComponent } from './environment/component';

import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

const entryComponents = [
    SidebarAppShellComponent,
    SidebarAppShellRunningComponent,
    SidebarAppShellInputComponent,
    SidebarAppShellEnvironmentVariablesComponent,
    SidebarAppShellTerminatedComponent,
    SidebarAppShellPresetComponent,
    SidebarAppShellEnvironmentComponent,
];

const modules = [
    FormsModule,
    CommonModule,
    PrimitiveModule,
    ContainersModule,
    ReactiveFormsModule,
    AppDirectiviesModule,
    EnvironmentCommonModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatExpansionModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
];

const directives = [FocusInputDirective];

@NgModule({
    entryComponents: [...entryComponents],
    imports: [...modules],
    declarations: [...entryComponents, ...directives],
    exports: [...entryComponents, ...directives],
})
export class SidebarAppShellModule {
    constructor() {}
}
