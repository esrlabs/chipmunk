import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { EditableModule } from '@ui/elements/editable/module';

import { Preset } from './preset/component';
import { History } from './component';
import { FilterPreview } from './preview/filter/component';

const entryComponents = [Preset, History, FilterPreview];
const components = [...entryComponents];

@NgModule({
    entryComponents: [...entryComponents],
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatCardModule,
        MatDividerModule,
        EditableModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class HistoryModule {}
