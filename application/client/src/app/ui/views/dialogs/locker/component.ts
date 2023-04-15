import { Component, ChangeDetectorRef, Input, AfterViewInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Initial } from '@env/decorators/initial';
import { Locker, Level } from '@ui/service/lockers';
import { Popup } from '@ui/service/popup';

@Component({
    selector: 'app-dialogs-locker-message',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class LockerMessage extends ChangesDetector implements AfterViewInit {
    @Input() public locker!: Locker;
    @Input() public popup!: Popup;
    @Input() public close!: () => void;

    protected keyboardUnlocker!: () => void;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public get Level(): typeof Level {
        return Level;
    }

    public ngAfterViewInit(): void {
        this.env().subscriber.register(
            this.locker.updated.subscribe(() => {
                this.detectChanges();
            }),
        );
    }

    ngClose() {
        this.close();
    }
}
export interface LockerMessage extends IlcInterface {}
