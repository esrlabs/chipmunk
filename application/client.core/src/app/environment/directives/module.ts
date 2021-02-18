import { NgModule                           } from '@angular/core';
import { MatDragDropResetFeatureDirective   } from './material.dragdrop.directive';
import { FocusDefaultButtonDirective        } from './focus.button.directive';

@NgModule({
    declarations    : [ MatDragDropResetFeatureDirective, FocusDefaultButtonDirective ],
    exports         : [ MatDragDropResetFeatureDirective, FocusDefaultButtonDirective ]
})

export class AppDirectiviesModule {
    constructor() {
    }
}
