import {
    Component,
    ChangeDetectorRef,
    AfterContentInit,
    OnDestroy,
    ViewEncapsulation,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Options as AutocompleteOptions } from '@elements/autocomplete/component';
import { Options as FoldersOptions } from '@elements/folderinput/component';
import { Subject } from '@platform/env/subscription';
import { CmdErrorState } from '../../bases/process/error';
import { SetupBase } from '../../bases/process/component';
import { Profile } from '@platform/types/bindings';

@Component({
    selector: 'app-process-quicksetup',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
    standalone: false,
})
@Ilc()
export class QuickSetup extends SetupBase implements AfterContentInit, OnDestroy {
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

    public getEnvvarsCount(profile: Profile) {
        return profile.envvars ? profile.envvars.size : 0;
    }

    public destroy(): Promise<void> {
        return Promise.resolve();
    }
}
export interface QuickSetup extends IlcInterface {}
