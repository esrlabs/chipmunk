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

const components = [TabObserve];

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
    declarations: [...components],
    exports: [...components],
    bootstrap: [...components, FileModule, ConcatModule, StreamModule],
})
export class ObserveModule {}
