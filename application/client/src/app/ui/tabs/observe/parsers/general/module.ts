import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DltGeneralConfigurationModule } from './dlt/module';
import { SomeIpGeneralConfigurationModule } from './someip/module';
import { TextGeneralConfigurationModule } from './text/module';
import { ParserGeneralConfiguration } from './component';

@NgModule({
    imports: [CommonModule, DltGeneralConfigurationModule, SomeIpGeneralConfigurationModule, TextGeneralConfigurationModule],
    declarations: [ParserGeneralConfiguration],
    exports: [
        ParserGeneralConfiguration,
        DltGeneralConfigurationModule,
        SomeIpGeneralConfigurationModule,
        TextGeneralConfigurationModule,
    ],
    bootstrap: [
        ParserGeneralConfiguration,
        DltGeneralConfigurationModule,
        SomeIpGeneralConfigurationModule,
        TextGeneralConfigurationModule,
    ],
})
export class ParserGeneralConfigurationModule {}
