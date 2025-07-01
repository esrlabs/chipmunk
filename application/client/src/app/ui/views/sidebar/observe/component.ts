import {
    Component,
    Input,
    ChangeDetectorRef,
    ViewEncapsulation,
    AfterContentInit,
} from '@angular/core';
import { Session } from '@service/session';
import { Stream } from '@service/session/dependencies/stream';
import { ObserveOperation } from '@service/session/dependencies/observing/operation';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-views-observe-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
    standalone: false,
})
@Initial()
@Ilc()
export class Observed extends ChangesDetector implements AfterContentInit {
    @Input() session!: Session;

    public stream!: Stream;
    public operations: ObserveOperation[] = [];

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.stream = this.session.stream;
        this.operations = this.stream.observe().operations();
        this.env().subscriber.register(
            this.stream.subjects.get().sources.subscribe(() => {
                this.update();
            }),
            this.stream.subjects.get().finished.subscribe(() => {
                this.update();
            }),
            this.stream.sde.subjects.get().selected.subscribe(() => {
                this.update();
            }),
        );
    }

    protected update() {
        this.operations = this.stream.observe().operations();
        this.detectChanges();
    }
}
export interface Observed extends IlcInterface {}
