import { NgModule } from '@angular/core';
import { ResizerDirective } from './resizer';
import { DraggingDirective } from './dragging';
import { ResizeObserverDirective } from './resize.observer';
import { MatDragDropResetFeatureDirective } from './material.dragdrop';
import { MatDragDropFileFeatureDirective } from './dragdrop.file';

@NgModule({
    declarations: [
        ResizerDirective,
        ResizeObserverDirective,
        DraggingDirective,
        MatDragDropResetFeatureDirective,
        MatDragDropFileFeatureDirective,
    ],
    exports: [
        ResizerDirective,
        ResizeObserverDirective,
        DraggingDirective,
        MatDragDropResetFeatureDirective,
        MatDragDropFileFeatureDirective,
    ],
    imports: [],
})
export class AppDirectiviesModule {}
