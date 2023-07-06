import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RecentNature } from './component';
import { RecentNatureConcat } from './concat/component';
import { RecentNatureFile } from './file/component';
import { RecentNatureUdp } from './udp/component';
import { RecentNatureTcp } from './tcp/component';
import { RecentNatureSerial } from './serial/component';
import { RecentNatureProcess } from './process/component';

const components = [
    RecentNature,
    RecentNatureConcat,
    RecentNatureFile,
    RecentNatureUdp,
    RecentNatureTcp,
    RecentNatureSerial,
    RecentNatureProcess,
];
@NgModule({
    imports: [CommonModule],
    declarations: [...components],
    exports: [...components],
})
export class RecentNatureModule {}
