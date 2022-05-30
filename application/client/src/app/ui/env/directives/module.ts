import { NgModule } from '@angular/core';
import { ResizerDirective } from './resizer';
import { ResizeObserverDirective } from './resize.observer';
import { MatDragDropResetFeatureDirective } from './material.dragdrop';

@NgModule({
    declarations: [ResizerDirective, ResizeObserverDirective, MatDragDropResetFeatureDirective],
    exports: [ResizerDirective, ResizeObserverDirective, MatDragDropResetFeatureDirective],
    imports: [],
})
export class AppDirectiviesModule {
    constructor() {}
}
