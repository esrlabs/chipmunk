import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

import { Jobs } from './component';

@NgModule({
    entryComponents: [Jobs],
    imports: [CommonModule, MatProgressSpinnerModule, MatIconModule],
    declarations: [Jobs],
    exports: [Jobs],
})
export class JobsModule {}
