import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@elements/containers/module';
import { MatButtonModule } from '@angular/material/button';
import { Observed } from './component';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { AttachSourceMenuModule } from '@elements/menu.attachsource/module';
import { ListModule as FileListModule } from './lists/file/module';
import { ListModule as ProcessListModule } from './lists/process/module';
import { ListModule as SerialListModule } from './lists/serial/module';
import { ListModule as TcpListModule } from './lists/tcp/module';
import { ListModule as UdpListModule } from './lists/udp/module';

const entryComponents = [Observed];
const components = [...entryComponents];

@NgModule({
    imports: [
        CommonModule,
        ContainersModule,
        MatButtonModule,
        MatCardModule,
        MatExpansionModule,
        FileListModule,
        ProcessListModule,
        SerialListModule,
        TcpListModule,
        UdpListModule,
        MatMenuModule,
        MatIconModule,
        MatDividerModule,
        AttachSourceMenuModule,
    ],
    declarations: [...components],
    exports: [...components]
})
export class ObservedModule {}
