import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@elements/containers/module';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

import { RecentFile } from './file/component';
import { RecentFileBase } from './file/base/component';
import { RecentFileDlt } from './file/dlt/component';
import { RecentActions } from './component';
import { RecentStream } from './stream/component';
import { DLTStream } from './stream/parsers/dlt/component';
import { SourceUdp } from './stream/sources/udp/component';
import { SourceProcess } from './stream/sources/process/component';

const components = [
    RecentStream,
    DLTStream,
    SourceUdp,
    SourceProcess,
    RecentFile,
    RecentActions,
    RecentFileDlt,
    RecentFileBase,
];
@NgModule({
    entryComponents: [...components],
    imports: [CommonModule, ContainersModule, MatButtonModule, MatIconModule, MatMenuModule],
    declarations: [...components],
    exports: [...components],
})
export class RecentActionsModule {}
