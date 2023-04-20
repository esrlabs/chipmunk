import {
    Component,
    Input,
    AfterContentInit,
    ChangeDetectorRef,
    HostBinding,
    ViewChild,
    ViewEncapsulation,
    OnDestroy,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Session } from '@service/session';
import { State } from './state';
import { ChangesDetector } from '@ui/env/extentions/changes';
import {
    AutocompleteInput,
    Options as AutocompleteOptions,
} from '@elements/autocomplete/component';
import { Subject } from '@platform/env/subscription';
import { unique } from '@platform/env/sequence';

const SDE_STATE = unique();

@Component({
    selector: 'app-views-sde',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Ilc()
export class ViewSdeComponent extends ChangesDetector implements AfterContentInit, OnDestroy {
    @ViewChild('sde') public sdeInputRef!: AutocompleteInput;

    @Input() public session!: Session;

    @HostBinding('style.display') get cssDisplayProp() {
        return this.state === undefined
            ? 'none'
            : this.state.operations.length > 0
            ? this.state.hidden
                ? 'none'
                : 'flex'
            : 'none';
    }
    public state!: State;
    public options: AutocompleteOptions = {
        name: 'SdeRecentList',
        storage: 'sde_sent_recent',
        defaults: '',
        placeholder: 'Enter command/data to send',
        label: 'Data to send',
        recent: new Subject<string | undefined>(),
    };

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this.state.destroy().catch((err: Error) => {
            this.log().error(`Fail to drop state: ${err.message}`);
        });
        this.session.storage.set(SDE_STATE, this.state);
    }

    public ngAfterContentInit(): void {
        const stored = this.session.storage.get<State>(SDE_STATE);
        this.state = stored !== undefined ? stored : new State();
        this.state.bind(this, this.session);
    }

    public enter(): void {
        const value = this.sdeInputRef.control.value;
        if (value.trim() === '') {
            return;
        }
        this.state
            .send(value)
            .then(() => {
                this.options.recent.emit(value);
            })
            .finally(() => {
                this.sdeInputRef.control.drop();
            });
        this.markChangesForCheck();
    }

    public panel(): void {
        this.markChangesForCheck();
    }
}
export interface ViewSdeComponent extends IlcInterface {}
