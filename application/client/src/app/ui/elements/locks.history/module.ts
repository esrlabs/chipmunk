import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { LocksHistory } from './component';
import { LocksHistoryEntry } from './entry/component';

@NgModule({
    imports: [CommonModule, MatIconModule],
    declarations: [LocksHistory, LocksHistoryEntry],
    exports: [LocksHistory],
})
export class LocksHistoryModule {}
