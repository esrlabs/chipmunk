import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProgressMessage } from './component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@NgModule({
    entryComponents: [ProgressMessage],
    imports: [CommonModule, MatProgressSpinnerModule, MatIconModule, MatButtonModule],
    declarations: [ProgressMessage],
    exports: [ProgressMessage],
})
export class ProgressMessageModule {}
