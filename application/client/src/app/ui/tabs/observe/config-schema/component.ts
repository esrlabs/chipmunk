import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { ConfigSchema, ConfigValue } from '@platform/types/plugins';
import { State as ParserState } from '../parsers/general/plugin/state';

@Component({
    selector: 'app-tab-config-schemas',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ConfigSchemas extends ChangesDetector {
    @Input() parserState!: ParserState;

    public readonly state: State = new State();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public reload() {
        this.state.reload(this.parserState);
    }
}

export interface ConfigSchemas extends IlcInterface {}
