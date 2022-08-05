import { Component, ChangeDetectorRef, Input, AfterViewInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Initial } from '@env/decorators/initial';
import { Progress } from './progress';

@Component({
    selector: 'app-dialogs-progress-message',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ProgressMessage extends ChangesDetector implements AfterViewInit {
    @Input() public progress!: Progress;
    @Input() public close!: () => void;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngAfterViewInit(): void {
        this.env().subscriber.register(
            this.progress.updated.subscribe(() => {
                this.detectChanges();
            }),
        );
    }

    ngClose() {
        this.close();
    }
}
export interface ProgressMessage extends IlcInterface {}
