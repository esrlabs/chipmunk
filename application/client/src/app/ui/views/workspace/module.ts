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
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

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
        MatButtonModule,
        AttachSourceMenuModule,
        FormsModule,
        ReactiveFormsModule,
    ],
    declarations: [
        ViewWorkspace,
        ViewContentMapComponent,
        ColumnsHeaders,
        ViewSdeComponent,
        ViewWorkspaceHeadersMenuComponent,
        ViewWorkspaceTitleComponent,
    ],
    exports: [ViewWorkspace, ScrollAreaModule],
})
export class WorkspaceModule {}
