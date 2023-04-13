import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { Transport } from './component';

@NgModule({
    imports: [CommonModule, MatIconModule],
    declarations: [Transport],
    exports: [Transport]
})
export class TransportReviewModule {}
