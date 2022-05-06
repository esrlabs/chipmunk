import { NgModule } from '@angular/core';
import { ResizerDirective } from './resizer';
import { ResizeObserverDirective } from './resize.observer';

@NgModule({
    declarations: [ResizerDirective, ResizeObserverDirective],
    exports: [ResizerDirective, ResizeObserverDirective],
    imports: [],
})
export class AppDirectiviesModule {
    constructor() {}
}
