import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';

import { Changelog } from './component';

const components = [Changelog];

@NgModule({
    imports: [CommonModule, MatCardModule, MatDividerModule],
    declarations: [...components],
    exports: [...components],
    bootstrap: [...components],
})
export class ChangelogModule {}
