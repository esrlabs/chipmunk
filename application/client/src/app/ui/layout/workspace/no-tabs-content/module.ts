import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@elements/containers/module';
import { RecentActionsModule } from '@elements/recent/module';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AppDirectiviesModule } from '@directives/module';

import { LayoutHome } from './component';
import { ActionComponent } from './action/component';

@NgModule({
    imports: [
        CommonModule,
        ContainersModule,
        MatButtonModule,
        MatCardModule,
        MatDividerModule,
        MatIconModule,
        MatMenuModule,
        RecentActionsModule,
        AppDirectiviesModule,
    ],
    declarations: [LayoutHome, ActionComponent],
    exports: [LayoutHome],
    bootstrap: [LayoutHome, ActionComponent],
})
export class LayoutHomeModule {}
