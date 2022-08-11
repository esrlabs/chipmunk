import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TransportReviewUdpModule } from './udp/module';
import { TransportReviewTcpModule } from './tcp/module';
import { TransportReviewSerialModule } from './serial/module';
import { TransportReviewProcessModule } from './process/module';
import { TransportReviewFileModule } from './file/module';

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
        TransportReviewUdpModule,
        TransportReviewTcpModule,
        TransportReviewSerialModule,
        TransportReviewProcessModule,
        TransportReviewFileModule,
    ],
    declarations: [Transport],
    exports: [
        Transport,
        TransportReviewUdpModule,
        TransportReviewTcpModule,
        TransportReviewSerialModule,
        TransportReviewProcessModule,
    ],
})
export class TransportReviewModule {}
