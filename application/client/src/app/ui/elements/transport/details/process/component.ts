import { Component, ChangeDetectorRef, Input, ViewChild, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Session } from '@service/session/session';
import { ProcessTransportSettings } from '@platform/types/transport/process';
import { ObserveOperation } from '@service/session/dependencies/observing/operation';
import { SdeRequest, SdeResponse } from '@platform/types/sde/commands';
import {
    Options as AutocompleteOptions,
    AutocompleteInput,
} from '@elements/autocomplete/component';
import { Subject } from '@platform/env/subscription';
import { DataSource } from '@platform/types/observe';

@Component({
    selector: 'app-transport-process-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportProcess extends ChangesDetector implements AfterContentInit {
    @Input() public observe!: ObserveOperation | undefined;
    @Input() public source!: DataSource;
    @Input() public session!: Session;

    @ViewChild('stdin') public input!: AutocompleteInput;

    public process!: ProcessTransportSettings;

    public readonly options: AutocompleteOptions = {
        name: 'CommandsRecentSentDataList',
        storage: 'processes_sending_recent',
        defaults: '',
        placeholder: 'Enter data to send',
        label: 'Enter data to send',
        recent: new Subject<void>(),
    };

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        const stream = this.source.asStream();
        if (stream === undefined) {
            throw new Error(`DataSource isn't bound to stream`);
        }
        const process = stream.process();
        if (process === undefined) {
            throw new Error(`DataSource isn't bound to Process stream`);
        }
        this.process = process;
    }

    public ngFullCommand(): string {
        return `${this.process.command}`;
    }

    public ngCwd(): string {
        return `${this.process.cwd === '' ? 'not defined' : this.process.cwd}`;
    }

    public ngEnter(event: string): void {
        if (this.observe === undefined) {
            return;
        }
        if (event === '') {
            return;
        }
        this.input.disable();
        this.observe
            .sendIntoSde<SdeRequest, SdeResponse>({
                WriteText: `${event}\n`,
            })
            .then((res) => {
                if (res.Error !== undefined) {
                    this.log().error(`Fail to process SDE: ${res.Error}`);
                    return;
                }
                this.options.recent.emit();
                this.input.set('');
            })
            .catch((err) => {
                this.log().error(`Fail to send SDE: ${err.message}`);
            })
            .finally(() => {
                this.input.enable().focus();
            });
        this.markChangesForCheck();
    }
}
export interface TransportProcess extends IlcInterface {}
