import {
    Component,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    OnChanges,
    SimpleChanges,
} from '@angular/core';

import { ChangesDetector } from '@ui/env/extentions/changes';
import { PluginConfigSchemaItem } from '@platform/types/bindings';
import { State } from '../../state';

@Component({
    selector: 'app-tabs-config-schema-float',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
export class ConfigSchemaFloat extends ChangesDetector implements AfterContentInit, OnChanges {
    @Input() public config!: PluginConfigSchemaItem;
    @Input() public state!: State;

    public value?: number;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['value']) {
            this.state.saveConfig(this.config.id, {
                Float: parseFloat(changes['value'].currentValue),
            });
        }
    }

    ngAfterContentInit(): void {
        this.value = 0.0;
        this.state.saveConfig(this.config.id, {
            Float: this.value,
        });
    }

    ngOnInputChange(event: Event): void {
        const target = event.target as HTMLInputElement;
        if (target) {
            this.state.saveConfig(this.config.id, { Float: parseFloat(target.value) });
        }
    }
}
