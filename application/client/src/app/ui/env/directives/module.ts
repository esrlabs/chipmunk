import { NgModule } from '@angular/core';
import { ResizerDirective } from './resizer';
import { ResizeObserverDirective } from './resize.observer';
import { MatDragDropResetFeatureDirective } from './material.dragdrop';
import { MatDragDropFileFeatureDirective } from './dragdrop.file';

const components = [
    ResizerDirective,
    ResizeObserverDirective,
    MatDragDropResetFeatureDirective,
    MatDragDropFileFeatureDirective,
];

@NgModule({
    declarations: [...components],
    exports: [...components],
    imports: [],
})
export class AppDirectiviesModule {}
