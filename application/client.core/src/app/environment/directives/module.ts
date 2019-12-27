import { NgModule                           } from '@angular/core';
import { MatAutocompleteTriggerDirective    } from './material.autocomplete.directive';

@NgModule({
    declarations    : [ MatAutocompleteTriggerDirective ],
    exports         : [ MatAutocompleteTriggerDirective ]
})

export class AppDirectiviesModule {
    constructor() {
    }
}
