import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TransportSerial } from './component';

@NgModule({
    entryComponents: [TransportSerial],
    imports: [CommonModule, MatIconModule],
    declarations: [TransportSerial],
    exports: [TransportSerial],
})
export class TransportReviewSerialModule {}
