import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { LocksHistory } from './component';
import { LocksHistoryEntry } from './entry/component';

const components = [LocksHistory, LocksHistoryEntry];

@NgModule({
    imports: [CommonModule, MatIconModule],
    declarations: [...components],
    exports: [...components]
})
export class LocksHistoryModule {}
