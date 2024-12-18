import { Component, ChangeDetectorRef, Input, AfterContentInit, OnDestroy } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { ConfigSchema } from '@platform/types/plugins';

@Component({
    selector: 'app-tabs-config-schema-string',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ConfigSchemaString extends ChangesDetector implements AfterContentInit, OnDestroy {
    @Input() public config!: ConfigSchema;
    //TODO AAZ: Check if this is needed. On String too!.
    @Input() public save!: (config: ConfigSchema) => void;

    public value?: string;

    //TODO AAZ: Check if constructor is called. On boolean component too!.
    constructor(cdRef: ChangeDetectorRef, defaultValue?: string) {
        super(cdRef);
        this.value = defaultValue;
    }

    ngAfterContentInit(): void {
        //TODO AAZ: Check if assigning values will be done here.
    }

    ngOnDestroy(): void {
        //TODO AAZ: Check if assigning to given value is needed.
        this.save(this.config);
    }
}
