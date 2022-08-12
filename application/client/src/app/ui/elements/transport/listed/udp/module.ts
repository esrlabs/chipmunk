import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TransportUdp } from './component';

@NgModule({
    entryComponents: [TransportUdp],
    imports: [CommonModule, MatIconModule],
    declarations: [TransportUdp],
    exports: [TransportUdp],
})
export class TransportReviewUdpModule {}
