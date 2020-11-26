import { NgModule                           } from '@angular/core';
import { MatAutocompleteTriggerDirective    } from './material.autocomplete.directive';
import { MatDragDropResetFeatureDirective   } from './material.dragdrop.directive';
import { FocusDefaultButtonDirective        } from './focus.button.directive';

@NgModule({
    declarations    : [ MatAutocompleteTriggerDirective, MatDragDropResetFeatureDirective, FocusDefaultButtonDirective ],
    exports         : [ MatAutocompleteTriggerDirective, MatDragDropResetFeatureDirective, FocusDefaultButtonDirective ]
})

export class AppDirectiviesModule {
    constructor() {
    }
}
