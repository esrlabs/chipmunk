import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { SetupModule as UdpSetupModule } from './complete/udp/module';
import { SetupModule as TcpSetupModule } from './complete/tcp/module';
import { SetupModule as SerialSetupModule } from './complete/serial/module';
import { SetupModule as ProcessSetupModule } from './complete/process/module';

import { Transport } from './component';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDividerModule,
        MatFormFieldModule,
        MatSelectModule,
        UdpSetupModule,
        TcpSetupModule,
        SerialSetupModule,
        ProcessSetupModule,
    ],
    declarations: [Transport],
    exports: [Transport, UdpSetupModule, TcpSetupModule, SerialSetupModule, ProcessSetupModule],
})
export class StreamsModule {}
