import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@elements/containers/module';
import { MatButtonModule } from '@angular/material/button';
import { AttachSourceMenu } from './component';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

@NgModule({
    imports: [
        CommonModule,
        ContainersModule,
        MatButtonModule,
        MatMenuModule,
        MatIconModule,
        MatDividerModule,
    ],
    declarations: [AttachSourceMenu],
    exports: [AttachSourceMenu],
})
export class AttachSourceMenuModule {}
