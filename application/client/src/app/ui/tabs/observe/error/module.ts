import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

import { TabObserveErrorState } from './component';

@NgModule({
    imports: [CommonModule, MatCardModule],
    declarations: [TabObserveErrorState],
    exports: [TabObserveErrorState],
    bootstrap: [TabObserveErrorState],
})
export class ErrorStateModule {}
