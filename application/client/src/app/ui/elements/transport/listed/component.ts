import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { DataSource, SourceDescription } from '@platform/types/observe';
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

    public description!: SourceDescription | undefined;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        const description = this.source.desc();
        if (description instanceof Error) {
            this.log().error(`Invalid description: ${description.message}`);
            return;
        }
        this.description = description;
    }
}
export interface Transport extends IlcInterface {}
