import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParserGeneralConfigurationModule } from './general/module';
import { ParserExtraConfigurationModule } from './extra/module';

@NgModule({
    imports: [CommonModule, ParserGeneralConfigurationModule, ParserExtraConfigurationModule],
    declarations: [],
    exports: [],
    bootstrap: [],
})
export class ParsersModule {}
