import { Component, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Locker, Level } from '@ui/service/lockers';

@Component({
    selector: 'app-elements-locks-history-entry',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class LocksHistoryEntry {
    @Input() locker!: Locker;

    public get Level(): typeof Level {
        return Level;
    }
}
export interface LocksHistoryEntry extends IlcInterface {}
