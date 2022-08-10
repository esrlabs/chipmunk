import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatInputModule } from '@angular/material/input';

import { TransportModule } from '@ui/elements/transport/module';
import { LocksHistoryModule } from '@ui/elements/locks.history/module';

import { TabSourceTextStream } from './component';
import { StreamActions } from '../common/stream.open/component';

@NgModule({
    entryComponents: [TabSourceTextStream, StreamActions],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        MatDividerModule,
        MatTableModule,
        MatSortModule,
        MatProgressBarModule,
        MatChipsModule,
        MatIconModule,
        MatFormFieldModule,
        MatSelectModule,
        MatListModule,
        MatInputModule,
        TransportModule,
        LocksHistoryModule,
    ],
    declarations: [TabSourceTextStream, StreamActions],
    exports: [TabSourceTextStream],
})
export class TabSourceTextStreamModule {}
