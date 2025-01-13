import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';

import { RowComponent } from './component';
import { Standard } from './standard/component';
import { Columns } from './columns/component';
import { Separator } from './separator/component';

import { ContainersModule } from '@elements/containers/module';

const components = [];

@NgModule({
    imports: [
        CommonModule,
        ScrollingModule,
        ContainersModule,
        MatIconModule,
        MatCheckboxModule,
        MatButtonModule,
    ],
    declarations: [RowComponent, Standard, Columns, Separator],
    exports: [RowComponent],
    bootstrap: [RowComponent, Standard, Columns, Separator],
})
export class RowModule {}
