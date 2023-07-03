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
    @Input() public state!: State;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.state.updated.subscribe(() => {
                this.detectChanges();
            }),
        );
    }

    public as(): {
        UDP(): Stream.Stream.UDP.Configuration | undefined;
        TCP(): Stream.Stream.TCP.Configuration | undefined;
        Serial(): Stream.Stream.Serial.Configuration | undefined;
        Process(): Stream.Stream.Process.Configuration | undefined;
    } {
        return {
            UDP: (): Stream.Stream.UDP.Configuration | undefined => {
                return this.state.configuration.as<Stream.Stream.UDP.Configuration>(
                    Stream.Stream.UDP.Configuration,
                );
            },
            TCP: (): Stream.Stream.TCP.Configuration | undefined => {
                return this.state.configuration.as<Stream.Stream.TCP.Configuration>(
                    Stream.Stream.TCP.Configuration,
                );
            },
            Serial: (): Stream.Stream.Serial.Configuration | undefined => {
                return this.state.configuration.as<Stream.Stream.Serial.Configuration>(
                    Stream.Stream.Serial.Configuration,
                );
            },
            Process: (): Stream.Stream.Process.Configuration | undefined => {
                return this.state.configuration.as<Stream.Stream.Process.Configuration>(
                    Stream.Stream.Process.Configuration,
                );
            },
        };
    }
}
export interface Transport extends IlcInterface {}
