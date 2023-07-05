import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

import { TabObserveErrorState } from './component';

const components = [TabObserveErrorState];

@NgModule({
    imports: [CommonModule, MatCardModule],
    declarations: [...components],
    exports: [...components],
    bootstrap: [...components],
})
export class ErrorStateModule {}
