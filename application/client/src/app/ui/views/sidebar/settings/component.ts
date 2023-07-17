import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Input
} from "@angular/core";
import { Ilc, IlcInterface } from "@env/decorators/component";
import { Initial } from "@env/decorators/initial";
import { Session } from '@service/session';
import { ChangesDetector } from "@ui/env/extentions/changes";

@Component({
    selector: 'app-views-settings',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})
@Initial()
@Ilc()
export class Settings extends ChangesDetector {
    @Input() session!: Session;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}
// export interface Settings extends IlcInterface {}
