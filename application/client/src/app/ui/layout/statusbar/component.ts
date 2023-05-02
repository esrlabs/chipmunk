import { Component, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-layout-statusbar',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class LayoutStatusBar extends ChangesDetector {
    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}
export interface LayoutStatusBar extends IlcInterface {}
