import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PluginsManager } from './component';
import { List } from './list/component';
import { Plugin } from './plugin/component';
import { Details } from './details/component';

@NgModule({
    imports: [
        CommonModule,
        MatCardModule,
        MatButtonModule,
        MatProgressBarModule,
        MatIconModule,
        MatProgressSpinnerModule,
    ],
    declarations: [PluginsManager, Plugin, List, Details],
    exports: [PluginsManager],
    bootstrap: [PluginsManager],
})
export class PluginsManagerModule {}
