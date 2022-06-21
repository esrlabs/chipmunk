import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TransportUdpModule } from './udp/module';
import { TransportTcpModule } from './tcp/module';
import { TransportSerialModule } from './serial/module';

import { Transport } from './component';

@NgModule({
    entryComponents: [Transport],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDividerModule,
        MatFormFieldModule,
        MatSelectModule,
        TransportUdpModule,
        TransportTcpModule,
        TransportSerialModule,
    ],
    declarations: [Transport],
    exports: [Transport, TransportUdpModule, TransportTcpModule, TransportSerialModule],
})
export class TransportModule {}
