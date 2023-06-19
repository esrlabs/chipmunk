import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@elements/containers/module';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { HiddenFilterModule } from '@elements/filter.hidden/module';

import { RecentActions } from './component';
import { RecentNatureModule } from './nature/module';

const components = [RecentActions];
@NgModule({
    imports: [
        CommonModule,
        ContainersModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        HiddenFilterModule,
        RecentNatureModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class RecentActionsModule {}
