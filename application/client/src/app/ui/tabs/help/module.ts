import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';

import { Help } from './component';

const components = [Help];

@NgModule({
    imports: [CommonModule, MatCardModule, MatDividerModule, MatButtonModule],
    declarations: [...components],
    exports: [...components],
    bootstrap: [...components],
})
export class HelpModule {}
