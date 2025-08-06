import { Component, Input, AfterContentInit, ChangeDetectorRef } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { State } from '@service/session/dependencies/observing/operation';
import { ObserveOperation } from '@service/session/dependencies/stream';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { getSourceColor } from '@ui/styles/colors';
import { Stream } from '@service/session/dependencies/stream';

@Component({
    selector: 'app-views-observed-operation',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Ilc()
export class Operation extends ChangesDetector implements AfterContentInit {
    @Input() operation!: ObserveOperation;
    @Input() stream!: Stream;

    public title!: string;
    public subtitle: string | undefined = undefined;
    public state!: State;
    public color!: string;

    protected update() {
        const descriptor = this.operation.getDescriptor();
        this.state = this.operation.state;
        if (descriptor) {
            this.title = descriptor.s_desc ? descriptor.s_desc : descriptor.source.name;
            this.subtitle = descriptor.p_desc ? descriptor.p_desc : descriptor.parser.name;
        } else {
            this.log().warn(`Descriptor of operation isn't available`);
            this.title = this.operation.getOrigin().getTitle();
            this.subtitle = undefined;
        }
        this.color = this.getSourceColor();
    }

    protected getSourceColor(): string {
        const id = this.stream.observe().descriptions.id(this.operation.uuid);
        return id === undefined ? '' : getSourceColor(id);
    }

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public get State() {
        return State;
    }

    public ngAfterContentInit(): void {
        this.update();
        this.env().subscriber.register(
            this.operation.stateUpdateEvent.subscribe(() => {
                this.update();
                this.detectChanges();
            }),
        );
    }

    public select() {
        this.stream.sde.selecting().select(this.operation.uuid);
    }

    public stop() {
        if (!this.operation.isRunning()) {
            return;
        }
        this.operation.abort().catch((err: Error) => {
            this.log().error(`Fail to stop operation: ${err.message}`);
        });
    }

    public restart() {
        if (this.operation.isRunning()) {
            return;
        }
        this.operation.restart().catch((err: Error) => {
            this.log().error(`Fail to restart operation: ${err.message}`);
        });
    }
}
export interface Operation extends IlcInterface {}
