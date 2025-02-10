import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ErrorStateModule } from '../../error/module';
import { DltGeneralConfigurationModule } from './dlt/module';
import { SomeIpGeneralConfigurationModule } from './someip/module';
import { TextGeneralConfigurationModule } from './text/module';
import { ParserPluginGeneralConfigurationModule } from './plugin/module';
import { ParserGeneralConfiguration } from './component';

@NgModule({
    imports: [
        CommonModule,
        DltGeneralConfigurationModule,
        SomeIpGeneralConfigurationModule,
        TextGeneralConfigurationModule,
        ParserPluginGeneralConfigurationModule,
        ErrorStateModule,
    ],
    declarations: [ParserGeneralConfiguration],
    exports: [
        ParserGeneralConfiguration,
        DltGeneralConfigurationModule,
        SomeIpGeneralConfigurationModule,
        TextGeneralConfigurationModule,
        ParserPluginGeneralConfigurationModule,
        ErrorStateModule,
    ],
    bootstrap: [ParserGeneralConfiguration],
})
export class ParserGeneralConfigurationModule {}
