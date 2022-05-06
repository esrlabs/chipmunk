import {
    Component,
    Input,
    AfterViewInit,
    ChangeDetectorRef,
    ChangeDetectionStrategy,
} from '@angular/core';
import { TabsService } from '@elements/tabs/service';
import { TabsOptions } from '@elements/tabs/options';
import { IComponentDesc } from '@elements/containers/dynamic/component';
import { AreaState } from '../state';
import { Subscription, Subject, Observable } from 'rxjs';
import { LayoutToolbarControls } from './controls/component';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';
import { Session } from '@service/session';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-layout-toolbar',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class LayoutToolbar extends ChangesDetector implements AfterViewInit {
    @Input() public session!: Session;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngAfterViewInit() {
        this.detectChanges();
    }
}
export interface LayoutToolbar extends IlcInterface {}
