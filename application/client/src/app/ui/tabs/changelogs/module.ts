import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';

import { Changelog } from './component';

@NgModule({
    imports: [CommonModule, MatCardModule, MatDividerModule],
    declarations: [Changelog],
    exports: [Changelog],
    bootstrap: [Changelog],
})
export class ChangelogModule {}
