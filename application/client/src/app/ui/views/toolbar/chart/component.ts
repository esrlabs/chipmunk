import {
    Component,
    Input,
    AfterViewInit,
    ChangeDetectorRef,
    ViewContainerRef,
} from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Session } from '@service/session';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { Chart, registerables } from 'chart.js';
import { State } from './state';

Chart.register(...registerables);

@Component({
    selector: 'app-views-chart',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ViewChart extends ChangesDetector implements AfterViewInit {
    @Input() public session!: Session;

    public state: State = new State();

    constructor(cdRef: ChangeDetectorRef, public vcRef: ViewContainerRef) {
        super(cdRef);
    }

    public ngAfterViewInit() {
        this.state.bind(this, this.session, this.vcRef.element.nativeElement as HTMLElement);
        this.state.init();
    }
}
export interface ViewChart extends IlcInterface {}
