import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AutocompleteModule } from '@elements/autocomplete/module';

import { TransportProcess } from './component';

@NgModule({
    entryComponents: [TransportProcess],
    imports: [CommonModule, AutocompleteModule],
    declarations: [TransportProcess],
    exports: [TransportProcess],
})
export class TransportProcessModule {}
