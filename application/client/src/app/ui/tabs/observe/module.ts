import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { FileModule } from './origin/file/module';
import { ConcatModule } from './origin/concat/module';
import { StreamModule } from './origin/stream/module';

import { TabObserve } from './component';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatSelectModule,
        FileModule,
        ConcatModule,
        StreamModule,
    ],
    declarations: [TabObserve],
    exports: [TabObserve],
    bootstrap: [TabObserve, FileModule, ConcatModule, StreamModule],
})
export class ObserveModule {}
