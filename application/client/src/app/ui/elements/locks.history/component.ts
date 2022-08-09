import {
    Component,
    ChangeDetectorRef,
    AfterContentInit,
    Input,
    AfterViewInit,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Initial } from '@env/decorators/initial';
import { Locker } from '@ui/service/lockers';

@Component({
    selector: 'app-elements-locks-history',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class LocksHistory extends ChangesDetector implements AfterContentInit, AfterViewInit {
    @Input() group!: string;

    public lockers: Locker[] = [];

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.ilc().services.ui.lockers.unbound.subscribe(() => {
                this.load();
            }),
        );
    }

    public ngAfterViewInit(): void {
        this.load();
    }

    protected load() {
        this.lockers = this.ilc().services.ui.lockers.get(this.group);
        this.detectChanges();
    }
}
export interface LocksHistory extends IlcInterface {}
