import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TransportDatailsUdpModule } from './udp/module';
import { TransportDatailsTcpModule } from './tcp/module';
import { TransportDatailsSerialModule } from './serial/module';
import { TransportDatailsProcessModule } from './process/module';
import { TransportDatailsFileModule } from './file/module';

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
        TransportDatailsUdpModule,
        TransportDatailsTcpModule,
        TransportDatailsSerialModule,
        TransportDatailsProcessModule,
        TransportDatailsFileModule,
    ],
    declarations: [Transport],
    exports: [
        Transport,
        TransportDatailsUdpModule,
        TransportDatailsTcpModule,
        TransportDatailsSerialModule,
        TransportDatailsProcessModule,
        TransportDatailsFileModule,
    ],
})
export class TransportDetailsModule {}
