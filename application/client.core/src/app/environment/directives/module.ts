import { NgModule                           } from '@angular/core';
import { MatAutocompleteTriggerDirective    } from './material.autocomplete.directive';
import { MatDragDropResetFeatureDirective   } from './material.dragdrop.directive';

@NgModule({
    declarations    : [ MatAutocompleteTriggerDirective, MatDragDropResetFeatureDirective ],
    exports         : [ MatAutocompleteTriggerDirective, MatDragDropResetFeatureDirective ]
})

export class AppDirectiviesModule {
    constructor() {
    }
}
