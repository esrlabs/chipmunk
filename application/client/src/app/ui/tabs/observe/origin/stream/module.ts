import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

import { TabObserveStream } from './component';
import { StreamsModule } from './transport/setup/module';
import { ParserGeneralConfigurationModule } from '@ui/tabs/observe/parsers/general/module';
import { RecentActionsModule } from '@elements/recent/module';

const components = [TabObserveStream];

@NgModule({
    imports: [CommonModule, MatCardModule, StreamsModule, ParserGeneralConfigurationModule,RecentActionsModule ],
    declarations: [...components],
    exports: [...components],
    bootstrap: [...components, StreamsModule],
})
export class StreamModule {}
