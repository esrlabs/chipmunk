import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { State as ParserState } from '../parsers/general/plugin/state';

@Component({
    selector: 'app-tab-config-schemas',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class ConfigSchemas extends ChangesDetector implements AfterContentInit {
    @Input() parserState!: ParserState;

    public readonly state: State = new State();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.parserState.selected.subscribe(() => {
                this.state.reload(this.parserState);
            }),
        );
    }
}

export interface ConfigSchemas extends IlcInterface {}
