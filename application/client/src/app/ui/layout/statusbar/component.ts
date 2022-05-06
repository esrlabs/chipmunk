import { Component, ChangeDetectorRef } from '@angular/core';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-layout-statusbar',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class LayoutStatusBar extends ChangesDetector {
    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}
export interface LayoutStatusBar extends IlcInterface {}
