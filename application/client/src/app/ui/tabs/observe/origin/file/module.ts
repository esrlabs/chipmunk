import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { ParserGeneralConfigurationModule } from '@ui/tabs/observe/parsers/general/module';
import { ParserExtraConfigurationModule } from '@ui/tabs/observe/parsers/extra/module';

import { TabObserveFile } from './component';

const components = [TabObserveFile];

@NgModule({
    imports: [
        CommonModule,
        MatCardModule,
        ParserGeneralConfigurationModule,
        ParserExtraConfigurationModule,
    ],
    declarations: [...components],
    exports: [...components],
    bootstrap: [...components],
})
export class FileModule {}
