import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';

import { Jobs } from './component';

@NgModule({
    imports: [
        CommonModule,
        MatProgressSpinnerModule,
        MatIconModule,
        MatMenuModule,
        MatButtonModule,
        MatDividerModule,
    ],
    declarations: [Jobs],
    exports: [Jobs]
})
export class JobsModule {}
