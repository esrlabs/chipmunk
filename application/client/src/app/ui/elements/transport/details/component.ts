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
        this.update().detectChanges();
    }

    public ngStop(): void {
        if (this.observer === undefined) {
            return;
        }
        this.observer
            .abort()
            .catch((err: Error) => {
                this.log().error(`Fail to stop observe operation: ${err.message}`);
            })
            .finally(() => {
                this.update().detectChanges();
            });
    }

    public ngRestart(): void {
        const sourceDef = this.source.asSourceDefinition();
        if (sourceDef instanceof Error) {
            return;
        }
        (() => {
            if (this.observer !== undefined) {
                return this.observer.restart();
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
            .services.system.opener.stream(sourceDef, undefined, undefined)
            .assign(this.session)
            .source(this.observer !== undefined ? this.observer.asSource() : this.source)
            .catch((err: Error) => {
                this.log().error(`Fail to clone source: ${err.message}`);
            });
    }

    public isTextFile(): boolean {
        return this.source.asFile() !== undefined && this.source.parser.Text === undefined;
    }

    protected update(): Transport {
        this.stopped = this.observer === undefined;
        return this;
    }
}
export interface Transport extends IlcInterface {}
