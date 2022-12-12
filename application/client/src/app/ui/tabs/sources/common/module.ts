import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { Actions } from './actions/component';

@NgModule({
    entryComponents: [Actions],
    imports: [CommonModule, MatCardModule, MatButtonModule],
    declarations: [Actions],
    exports: [Actions],
    bootstrap: [Actions],
})
export class SourcesCommonModule {}
