import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AutocompleteModule } from '@elements/autocomplete/module';
import { FolderInputModule } from '@elements/folderinput/module';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { QuickSetup } from './component';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@NgModule({
    imports: [
        CommonModule,
        AutocompleteModule,
        FolderInputModule,
        MatMenuModule,
        MatDividerModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
    ],
    declarations: [QuickSetup],
    exports: [QuickSetup]
})
export class QuickSetupModule {}
