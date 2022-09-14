import { Component, ChangeDetectorRef, Input, ViewChild } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Session } from '@service/session/session';
import { ProcessTransportSettings } from '@platform/types/transport/process';
import { ObserveOperation } from '@service/session/dependencies/observe/operation';
import { SdeRequest, SdeResponse } from '@platform/types/sde/commands';
import {
    Options as AutocompleteOptions,
    AutocompleteInput,
} from '@elements/autocomplete/component';
import { Subject } from '@platform/env/subscription';

@Component({
    selector: 'app-transport-process-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportProcess extends ChangesDetector {
    @Input() public observe!: ObserveOperation | undefined;
    @Input() public source!: ProcessTransportSettings;
    @Input() public session!: Session;

    @ViewChild('stdin') public input!: AutocompleteInput;

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

    public ngFullCommand(): string {
        return `${this.source.command} ${this.source.args.join(' ')}`;
    }

    public ngCwd(): string {
        return `${this.source.cwd === '' ? 'not defined' : this.source.cwd}`;
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
