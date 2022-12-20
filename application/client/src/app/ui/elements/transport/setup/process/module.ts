import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AutocompleteModule } from '@elements/autocomplete/module';
import { FolderInputModule } from '@elements/folderinput/module';

import { TransportProcess } from './component';

@NgModule({
    entryComponents: [TransportProcess],
    imports: [CommonModule, AutocompleteModule, FolderInputModule],
    declarations: [TransportProcess],
    exports: [TransportProcess],
})
export class TransportProcessModule {}
