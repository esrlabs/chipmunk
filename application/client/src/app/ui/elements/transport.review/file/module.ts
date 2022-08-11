import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TransportFile } from './component';

@NgModule({
    entryComponents: [TransportFile],
    imports: [CommonModule, MatIconModule],
    declarations: [TransportFile],
    exports: [TransportFile],
})
export class TransportReviewFileModule {}
