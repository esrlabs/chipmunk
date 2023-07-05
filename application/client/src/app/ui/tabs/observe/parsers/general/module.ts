import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ErrorStateModule } from '../../error/module';
import { DltGeneralConfigurationModule } from './dlt/module';
import { SomeIpGeneralConfigurationModule } from './someip/module';
import { TextGeneralConfigurationModule } from './text/module';
import { ParserGeneralConfiguration } from './component';

@NgModule({
    imports: [CommonModule, DltGeneralConfigurationModule, SomeIpGeneralConfigurationModule, TextGeneralConfigurationModule, ErrorStateModule],
    declarations: [ParserGeneralConfiguration],
    exports: [
        ParserGeneralConfiguration,
        DltGeneralConfigurationModule,
        SomeIpGeneralConfigurationModule,
        TextGeneralConfigurationModule,
        ErrorStateModule,
    ],
    bootstrap: [
        ParserGeneralConfiguration,
        DltGeneralConfigurationModule,
        SomeIpGeneralConfigurationModule,
        TextGeneralConfigurationModule,
        ErrorStateModule,
    ],
})
export class ParserGeneralConfigurationModule {}
