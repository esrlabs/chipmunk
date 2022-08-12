import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Session } from '@service/session/session';
import { ProcessTransportSettings } from '@platform/types/transport/process';

@Component({
    selector: 'app-transport-process-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportProcess extends ChangesDetector {
    @Input() public source!: ProcessTransportSettings;
    @Input() public session!: Session;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngFullCommand(): string {
        return `${this.source.command} + ${this.source.args.join(' ')}`;
    }

    public ngCwd(): string {
        return `${this.source.cwd === '' ? 'not defined' : this.source.cwd}`;
    }
}
export interface TransportProcess extends IlcInterface {}
