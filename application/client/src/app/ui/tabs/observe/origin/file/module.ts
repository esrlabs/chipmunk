import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { ParserGeneralConfigurationModule } from '@ui/tabs/observe/parsers/general/module';
import { ParserExtraConfigurationModule } from '@ui/tabs/observe/parsers/extra/module';

import { TabObserveFile } from './component';

@NgModule({
    imports: [
        CommonModule,
        MatCardModule,
        ParserGeneralConfigurationModule,
        ParserExtraConfigurationModule,
    ],
    declarations: [TabObserveFile],
    exports: [TabObserveFile],
    bootstrap: [TabObserveFile],
})
export class FileModule {}
