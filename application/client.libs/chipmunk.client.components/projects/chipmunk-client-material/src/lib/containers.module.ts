import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { DynamicComponent                       } from './dynamic/component';
import { FrameComponent                         } from './frame/component';

const components = [
    DynamicComponent,
    FrameComponent
];

@NgModule({
    entryComponents : [ ...components ],
    imports         : [ CommonModule ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class ContainersModule { }
