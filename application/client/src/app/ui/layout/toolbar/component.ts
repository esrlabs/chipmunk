import {
    Component,
    Input,
    AfterViewInit,
    ChangeDetectorRef,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Base } from '@service/session';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-layout-toolbar',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class LayoutToolbar extends ChangesDetector implements AfterViewInit {
    @Input() public session!: Base;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngAfterViewInit() {
        this.detectChanges();
    }
}
export interface LayoutToolbar extends IlcInterface {}
