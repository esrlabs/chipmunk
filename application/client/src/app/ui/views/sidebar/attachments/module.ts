import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@elements/containers/module';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Attachments } from './component';
import { ItemModule } from './attachment/module';
import { PreviewModule } from './preview/module';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

@NgModule({
    imports: [
        CommonModule,
        ContainersModule,
        MatButtonModule,
        MatCardModule,
        MatExpansionModule,
        MatMenuModule,
        MatIconModule,
        MatDividerModule,
        ItemModule,
        PreviewModule,
    ],
    declarations: [Attachments],
    exports: [Attachments],
})
export class AttachmentsModule {}
