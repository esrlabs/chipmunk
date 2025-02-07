import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

import { PluginsManager } from './component';

@NgModule({
    imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule],
    declarations: [PluginsManager],
    exports: [PluginsManager],
    bootstrap: [PluginsManager],
})
export class PluginsManagerModule {}
