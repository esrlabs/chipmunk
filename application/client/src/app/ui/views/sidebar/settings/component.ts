import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Input
} from "@angular/core";
import { Session } from '@service/session';
import { ChangesDetector } from "@ui/env/extentions/changes";

@Component({
    selector: 'app-views-settings'
})
export class Settings extends ChangesDetector {
    @Input() session!: Session;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}