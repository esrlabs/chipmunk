import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DltGeneralConfigurationModule } from './dlt/module';
import { SomeIpGeneralConfigurationModule } from './someip/module';
import { ParserGeneralConfiguration } from './component';

@NgModule({
    imports: [CommonModule, DltGeneralConfigurationModule, SomeIpGeneralConfigurationModule],
    declarations: [ParserGeneralConfiguration],
    exports: [
        ParserGeneralConfiguration,
        DltGeneralConfigurationModule,
        SomeIpGeneralConfigurationModule,
    ],
    bootstrap: [
        ParserGeneralConfiguration,
        DltGeneralConfigurationModule,
        SomeIpGeneralConfigurationModule,
    ],
})
export class ParserGeneralConfigurationModule {}
