import { Component, ChangeDetectorRef, Input, ViewChild, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Session } from '@service/session/session';
import { SerialTransportSettings } from '@platform/types/transport/serial';
import { ObserveOperation } from '@service/session/dependencies/observing/operation';
import {
    Options as AutocompleteOptions,
    AutocompleteInput,
} from '@elements/autocomplete/component';
import { Subject } from '@platform/env/subscription';
import { DataSource } from '@platform/types/observe';

@Component({
    selector: 'app-transport-serial-details',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportSerial extends ChangesDetector implements AfterContentInit {
    @Input() public observe!: ObserveOperation | undefined;
    @Input() public source!: DataSource;
    @Input() public session!: Session;

    @ViewChild('message') public input!: AutocompleteInput;

    public serial!: SerialTransportSettings;

    public readonly options: AutocompleteOptions = {
        name: 'SerialRecentSentMessageList',
        storage: 'serial_sending_recent',
        defaults: '',
        placeholder: 'Enter message to send',
        label: 'Enter message to send',
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
        const serial = stream.serial();
        if (serial === undefined) {
            throw new Error(`DataSource isn't bound to Serial stream`);
        }
        this.serial = serial;
    }

    public ngEnter(event: string): void {
        if (this.observe === undefined) {
            return;
        }
        if (event === '') {
            return;
        }
        this.input.disable();
        // this.observe
        //     .sendIntoSde<SdeRequest, SdeResponse>({
        //         WriteText: `${event}\n`,
        //     })
        //     .then((res) => {
        //         if (res.Error !== undefined) {
        //             this.log().error(`Fail to process SDE: ${res.Error}`);
        //             return;
        //         }
        //         this.options.recent.emit();
        //         this.input.set('');
        //     })
        //     .catch((err) => {
        //         this.log().error(`Fail to send SDE: ${err.message}`);
        //     })
        //     .finally(() => {
        //         this.input.enable().focus();
        //     });
    }
}
export interface TransportSerial extends IlcInterface {}
