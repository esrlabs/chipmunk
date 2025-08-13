import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@elements/containers/module';
import { MatButtonModule } from '@angular/material/button';
import { AttachSourceMenu } from './component';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@NgModule({
    imports: [
        CommonModule,
        ContainersModule,
        MatButtonModule,
        MatMenuModule,
        MatDividerModule,
        MatProgressSpinnerModule,
    ],
    declarations: [AttachSourceMenu],
    exports: [AttachSourceMenu],
})
export class AttachSourceMenuModule {}
