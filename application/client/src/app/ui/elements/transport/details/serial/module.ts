import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TransportSerial } from './component';
import { AutocompleteModule } from '@elements/autocomplete/module';
import { MatDividerModule } from '@angular/material/divider';

@NgModule({
    entryComponents: [TransportSerial],
    imports: [CommonModule, MatIconModule, AutocompleteModule, MatDividerModule],
    declarations: [TransportSerial],
    exports: [TransportSerial],
})
export class TransportDatailsSerialModule {}
