import {
    Component,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    AfterContentChecked,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { DataSource, Source } from '@platform/types/observe';
import { Session } from '@service/session/session';
import { ObserveOperation } from '@service/session/dependencies/observe/operation';
// import { SdeRequest, SdeResponse } from '@platform/types/sde/processes';

@Component({
    selector: 'app-transport-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Transport extends ChangesDetector implements AfterContentInit, AfterContentChecked {
    @Input() public source!: DataSource | ObserveOperation;
    @Input() public session!: Session;

    public verified: Source = {};
    public stopped: boolean = false;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.update();
    }

    public ngAfterContentChecked(): void {
        this.update();
        this.detectChanges();
    }

    public ngStop(): void {
        if (!(this.source instanceof ObserveOperation)) {
            return;
        }
        this.source
            .abort()
            .catch((err: Error) => {
                this.log().error(`Fail to stop observe operation: ${err.message}`);
            })
            .finally(() => {
                this.detectChanges();
            });
    }

    public ngRestart(): void {
        const sourceDef =
            this.source instanceof DataSource
                ? this.source.asSourceDefinition()
                : this.source.asSource().asSourceDefinition();
        if (sourceDef instanceof Error) {
            return;
        }
        (() => {
            if (this.source instanceof ObserveOperation) {
                return this.source.restart();
            } else {
                return this.session.stream.connect(sourceDef).source(this.source);
            }
        })()
            .catch((err: Error) => {
                this.log().error(`Fail to restart observe operation: ${err.message}`);
            })
            .finally(() => {
                this.detectChanges();
            });
    }

    public ngClone(): void {
        const sourceDef =
            this.source instanceof DataSource
                ? this.source.asSourceDefinition()
                : this.source.asSource().asSourceDefinition();
        if (sourceDef instanceof Error) {
            return;
        }
        this.ilc()
            .services.system.opener.stream(sourceDef)
            .assign(this.session)
            .source(this.source instanceof ObserveOperation ? this.source.asSource() : this.source);
        if (!(this.source instanceof ObserveOperation)) {
            return;
        }
    }

    public isTextFile(): boolean {
        const source =
            this.source instanceof ObserveOperation ? this.source.asSource() : this.source;
        return source.File !== undefined && source.File[1].Text !== undefined ? true : false;
    }

    protected update() {
        const source = (
            this.source instanceof ObserveOperation ? this.source.asSource() : this.source
        ).getSource();
        this.stopped = !(this.source instanceof ObserveOperation);
        if (source instanceof Error) {
            this.log().error(`Invalid source: ${source.message}`);
            return;
        }
        this.verified = source;
    }
}
export interface Transport extends IlcInterface {}
