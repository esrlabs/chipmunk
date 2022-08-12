import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TransportTcp } from './component';

@NgModule({
    entryComponents: [TransportTcp],
    imports: [CommonModule, MatIconModule],
    declarations: [TransportTcp],
    exports: [TransportTcp],
})
export class TransportDatailsTcpModule {}
