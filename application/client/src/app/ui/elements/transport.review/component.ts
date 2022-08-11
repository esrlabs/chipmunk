import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { DataSource, Source } from '@platform/types/observe';
import { Session } from '@service/session/session';

@Component({
    selector: 'app-transport-review',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Transport extends ChangesDetector implements AfterContentInit {
    @Input() public source!: DataSource;
    @Input() public session!: Session;

    public verified: Source = {};

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        const source = this.source.getSource();
        if (source instanceof Error) {
            this.log().error(`Invalid source: ${source.message}`);
            return;
        }
        this.verified = source;
    }
}
export interface Transport extends IlcInterface {}
