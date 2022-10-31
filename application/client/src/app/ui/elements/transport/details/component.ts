import {
    Component,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    AfterContentChecked,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { DataSource } from '@platform/types/observe';
import { Session } from '@service/session/session';
import { ObserveOperation } from '@service/session/dependencies/observe/operation';

@Component({
    selector: 'app-transport-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Transport extends ChangesDetector implements AfterContentInit, AfterContentChecked {
    @Input() public source!: DataSource;
    @Input() public observer!: ObserveOperation | undefined;
    @Input() public session!: Session;

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

    public ngGetObserveHandle(): ObserveOperation | undefined {
        return this.source instanceof ObserveOperation ? this.source : undefined;
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
        const sourceDef = this.source.asSourceDefinition();
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
        const sourceDef = this.source.asSourceDefinition();
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
        return this.source.asFile() !== undefined && this.source.parser.Text === undefined;
    }

    protected update() {
        this.stopped = !(this.source instanceof ObserveOperation);
    }
}
export interface Transport extends IlcInterface {}
