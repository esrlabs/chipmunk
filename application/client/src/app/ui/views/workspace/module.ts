import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewWorkspace } from './component';
import { ViewContentMapComponent } from './map/component';
import { ViewSdeComponent } from './sde/component';
import { ViewWorkspaceTitleComponent } from './title/component';
import { ViewWorkspaceHeadersMenuComponent } from './headers/menu/component';
import { ColumnsHeaders } from './headers/component';
import { ScrollAreaModule } from '@elements/scrollarea/module';
import { ContainersModule } from '@elements/containers/module';
import { AppDirectiviesModule } from '@directives/module';
import { AutocompleteModule } from '@elements/autocomplete/module';
import { AttachSourceMenuModule } from '@elements/menu.attachsource/module';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

const entryComponents = [
    ViewWorkspace,
    ViewContentMapComponent,
    ColumnsHeaders,
    ViewSdeComponent,
    ViewWorkspaceHeadersMenuComponent,
    ViewWorkspaceTitleComponent,
];
const components = [ViewWorkspace, ...entryComponents];

@NgModule({
    imports: [
        CommonModule,
        ContainersModule,
        ScrollAreaModule,
        AppDirectiviesModule,
        AutocompleteModule,
        MatMenuModule,
        MatCheckboxModule,
        MatDividerModule,
        MatIconModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        AttachSourceMenuModule,
        FormsModule,
        ReactiveFormsModule,
    ],
    declarations: [...components],
    exports: [...components, ScrollAreaModule],
})
export class WorkspaceModule {}
