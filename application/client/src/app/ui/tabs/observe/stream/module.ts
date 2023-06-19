import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

import { TabObserveStream } from './component';
import { StreamsModule } from './transport/setup/module';
import { ParserGeneralConfigurationModule } from '@elements/parsers/general/module';

const components = [TabObserveStream];

@NgModule({
    imports: [
        CommonModule,
        MatCardModule,
        StreamsModule,
        ParserGeneralConfigurationModule,
    ],
    declarations: [...components],
    exports: [...components],
    bootstrap: [...components, StreamsModule],
})
export class StreamModule {}
