import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DynamicComponent } from './dynamic/component';
import { FrameComponent } from './frame/component';

@NgModule({
    imports: [CommonModule],
    declarations: [DynamicComponent, FrameComponent],
    exports: [DynamicComponent, FrameComponent],
})
export class ContainersModule {}
