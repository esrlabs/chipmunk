import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { LockerMessage } from './component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@NgModule({
    imports: [
        CommonModule,
        MatProgressSpinnerModule,
        MatIconModule,
        MatButtonModule,
        MatProgressBarModule,
    ],
    declarations: [LockerMessage],
    exports: [LockerMessage],
    bootstrap: [LockerMessage]
})
export class LockerMessageModule {}
