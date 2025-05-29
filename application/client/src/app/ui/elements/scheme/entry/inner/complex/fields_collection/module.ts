import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

import { FieldsCollection } from './component';
import { SchemeEntry } from '../../../component';

@NgModule({
    imports: [CommonModule, MatButtonModule, MatIcon, SchemeEntry],
    declarations: [FieldsCollection],
    exports: [FieldsCollection],
    bootstrap: [],
})
export class FieldsCollectionModule {}
