import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TransportProcess } from './component';
import { AutocompleteModule } from '@elements/autocomplete/module';
import { MatDividerModule } from '@angular/material/divider';

@NgModule({
    entryComponents: [TransportProcess],
    imports: [CommonModule, MatButtonModule, MatIconModule, AutocompleteModule, MatDividerModule],
    declarations: [TransportProcess],
    exports: [TransportProcess],
})
export class TransportDatailsProcessModule {}
