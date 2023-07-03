import {
    Component,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    AfterViewInit,
    OnDestroy,
    ViewEncapsulation,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Options as AutocompleteOptions } from '@elements/autocomplete/component';
import { Options as FoldersOptions } from '@elements/folderinput/component';
import { Subject } from '@platform/env/subscription';
import { CmdErrorState } from '../../bases/process/error';
import { SetupBase } from '../../bases/process/component';

@Component({
    selector: 'app-transport-process',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Ilc()
export class Setup extends SetupBase implements AfterContentInit, AfterViewInit, OnDestroy {
    @Input() public update?: Subject<void>;

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
            label: 'Working folder',
            defaults: '',
            passive: true,
        },
    };

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
        this.setInputs(this.inputs);
    }

    public override ngAfterContentInit(): void {
        this.update !== undefined &&
            this.env().subscriber.register(
                this.update.subscribe(() => {
                    this.cmdInputRef.set(this.state.configuration.configuration.command);
                    this.cwdInputRef.set(this.state.configuration.configuration.cwd);
                }),
            );
        super.ngAfterContentInit();
    }
}
export interface Setup extends IlcInterface {}
