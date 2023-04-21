import {
    Component,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    OnDestroy,
    ViewEncapsulation,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { State } from '../../states/process';
import { Options as AutocompleteOptions } from '@elements/autocomplete/component';
import { Options as FoldersOptions } from '@elements/folderinput/component';
import { Subject } from '@platform/env/subscription';
import { CmdErrorState } from '../../bases/process/error';
import { Session } from '@service/session';
import { unique } from '@platform/env/sequence';
import { SetupBase } from '../../bases/process/component';

const QUICK_TRANSPORT_STATE = unique();

@Component({
    selector: 'app-process-quicksetup',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Ilc()
export class QuickSetup extends SetupBase implements AfterContentInit, OnDestroy {
    @Input() public session!: Session;

    public override state: State = new State();

    public readonly inputs: {
        cmd: AutocompleteOptions;
        cwd: FoldersOptions;
    } = {
        cmd: {
            name: 'CommandsRecentList',
            storage: 'processes_cmd_recent',
            defaults: '',
            placeholder: 'Enter terminal command',
            label: 'Terminal command',
            recent: new Subject<string | undefined>(),
            error: new CmdErrorState(),
        },
        cwd: {
            placeholder: 'Enter working folder',
            label: undefined,
            defaults: '',
            passive: true,
        },
    };

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
        this.setInputs(this.inputs);
    }

    public override ngOnDestroy(): void {
        this.session.storage.set(QUICK_TRANSPORT_STATE, this.state);
        super.ngOnDestroy();
    }

    public override ngAfterContentInit(): void {
        const stored = this.session.storage.get<State>(QUICK_TRANSPORT_STATE);
        this.state = stored === undefined ? new State() : stored;
        super.ngAfterContentInit();
    }
}
export interface QuickSetup extends IlcInterface {}
