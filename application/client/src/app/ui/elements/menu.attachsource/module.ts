import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@elements/containers/module';
import { MatButtonModule } from '@angular/material/button';
import { AttachSourceMenu } from './component';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

const entryComponents = [AttachSourceMenu];
const components = [...entryComponents];

@NgModule({
    imports: [
        CommonModule,
        ContainersModule,
        MatButtonModule,
        MatMenuModule,
        MatIconModule,
        MatDividerModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class AttachSourceMenuModule {}
