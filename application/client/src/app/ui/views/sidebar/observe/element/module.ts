import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Item } from './component';
import { Item as FileItem } from './file/component';
import { Item as ProcessItem } from './process/component';
import { Item as SerialItem } from './serial/component';
import { Item as TCPItem } from './tcp/component';
import { Item as UDPItem } from './udp/component';
import { Signature } from './signature/component';

@NgModule({
    imports: [CommonModule],
    declarations: [Item, FileItem, ProcessItem, SerialItem, TCPItem, UDPItem, Signature],
    exports: [Item],
})
export class ElementModule {}
