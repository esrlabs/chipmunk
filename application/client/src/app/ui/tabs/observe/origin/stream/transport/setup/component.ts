import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';

import * as Stream from '@platform/types/observe/origin/stream';

@Component({
    selector: 'app-transport',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Transport extends ChangesDetector implements AfterContentInit {
    public Source = Stream.Stream.Source;

    @Input() public state!: State;

    public instance: {
        [Stream.Stream.Source.Process]: Stream.Stream.Process.Configuration | undefined;
        [Stream.Stream.Source.Serial]: Stream.Stream.Serial.Configuration | undefined;
        [Stream.Stream.Source.UDP]: Stream.Stream.UDP.Configuration | undefined;
        [Stream.Stream.Source.TCP]: Stream.Stream.TCP.Configuration | undefined;
    } = {
        [Stream.Stream.Source.Process]: undefined,
        [Stream.Stream.Source.Serial]: undefined,
        [Stream.Stream.Source.UDP]: undefined,
        [Stream.Stream.Source.TCP]: undefined,
    };

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.state.updated.subscribe(() => {
                this.update().detectChanges();
            }),
        );
        this.update();
    }

    protected update(): Transport {
        (this.instance as any) = {
            [this.state.configuration.instance.alias()]: this.state.configuration.instance,
        };
        return this;
    }
}
export interface Transport extends IlcInterface {}
