import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';

import { Help } from './component';

@NgModule({
    imports: [CommonModule, MatCardModule, MatDividerModule, MatButtonModule],
    declarations: [Help],
    exports: [Help],
    bootstrap: [Help],
})
export class HelpModule {}
