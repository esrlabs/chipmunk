import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@ui/elements/containers/module';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { FilterInputModule } from '@elements/filter/module';

import { RecentActionsMini } from './component';

const components = [RecentActionsMini];
@NgModule({
    entryComponents: [...components],
    imports: [
        CommonModule,
        ContainersModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        FilterInputModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class RecentActionsMiniModule {}
