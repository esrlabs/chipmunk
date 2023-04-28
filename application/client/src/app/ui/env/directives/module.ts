import { NgModule } from '@angular/core';
import { ResizerDirective } from './resizer';
import { DraggingDirective } from './dragging';
import { ResizeObserverDirective } from './resize.observer';
import { MatDragDropResetFeatureDirective } from './material.dragdrop';
import { MatDragDropFileFeatureDirective } from './dragdrop.file';

const components = [
    ResizerDirective,
    ResizeObserverDirective,
    DraggingDirective,
    MatDragDropResetFeatureDirective,
    MatDragDropFileFeatureDirective,
];

@NgModule({
    declarations: [...components],
    exports: [...components],
    imports: [],
})
export class AppDirectiviesModule {}
