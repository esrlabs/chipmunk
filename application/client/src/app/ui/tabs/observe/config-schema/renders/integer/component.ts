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
    selector: 'app-tabs-config-schema-integer',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
export class ConfigSchemaInteger extends ChangesDetector implements AfterContentInit, OnChanges {
    @Input() public config!: PluginConfigSchemaItem;
    @Input() public state!: State;

    public value?: number;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['value']) {
            this.state.saveConfig(this.config.id, {
                Integer: parseInt(changes['value'].currentValue, 10),
            });
        }
    }

    ngAfterContentInit(): void {
        const input_type = this.config.input_type;
        this.value = this.state.isIntegerItem(input_type) ? input_type.Integer : 0;
        this.state.saveConfig(this.config.id, { Integer: this.value });
    }

    public ngOnInputChange(event: Event): void {
        const target = event.target as HTMLInputElement;
        if (target) {
            this.state.saveConfig(this.config.id, { Integer: parseInt(target.value, 10) });
        }
    }
}
