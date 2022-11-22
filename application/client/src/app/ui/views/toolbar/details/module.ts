import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Details } from './component';

const entryComponents = [Details];
const components = [...entryComponents];

@NgModule({
    entryComponents: [...entryComponents],
    imports: [CommonModule, MatIconModule, MatButtonModule],
    declarations: [...components],
    exports: [...components],
})
export class DetailsModule {}
