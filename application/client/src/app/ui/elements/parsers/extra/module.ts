import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DltExtraConfigurationModule } from './dlt/module';
import { SomeIpExtraConfigurationModule } from './someip/module';
import { ParserExtraConfiguration } from './component';
@NgModule({
    imports: [CommonModule, DltExtraConfigurationModule, SomeIpExtraConfigurationModule],
    declarations: [ParserExtraConfiguration],
    exports: [
        ParserExtraConfiguration,
        DltExtraConfigurationModule,
        SomeIpExtraConfigurationModule,
    ],
    bootstrap: [
        ParserExtraConfiguration,
        DltExtraConfigurationModule,
        SomeIpExtraConfigurationModule,
    ],
})
export class ParserExtraConfigurationModule {}
