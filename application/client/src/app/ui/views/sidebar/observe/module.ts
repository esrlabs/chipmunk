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
import { Operation } from './operation/component';

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
        AttachSourceMenuModule,
    ],
    declarations: [Observed, Operation],
    exports: [Observed],
    bootstrap: [Observed],
})
export class ObservedModule {}
