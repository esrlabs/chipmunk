import {
    Component,
    HostListener,
    AfterViewInit,
    ChangeDetectorRef,
    ViewContainerRef,
    Input,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { Session } from '@service/session';

@Component({
    selector: 'app-views-chart-zoomer-cursor-canvas',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class ViewChartZoomerCursorCanvas extends ChangesDetector implements AfterViewInit {
    @Input() session!: Session;

    public state: State = new State();

    constructor(cdRef: ChangeDetectorRef, public vcRef: ViewContainerRef) {
        super(cdRef);
    }

    @HostListener('wheel', ['$event']) _ng_onWheel(event: WheelEvent) {
        this.state.onWheel(event);
    }

    @HostListener('click', ['$event']) _ng_onClick(event: MouseEvent) {
        this.state.onClick(event);
    }

    public ngAfterViewInit() {
        this.state.bind(this, this.session, this.vcRef.element.nativeElement as HTMLElement);
        this.state.init();
    }

    public ngOnDestroy() {
        this.state.destroy();
    }
}

export interface ViewChartZoomerCursorCanvas extends IlcInterface {}
