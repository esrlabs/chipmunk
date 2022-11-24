import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { About } from './component';

@NgModule({
    entryComponents: [About],
    imports: [CommonModule, MatButtonModule],
    declarations: [About],
    exports: [About],
})
export class AboutModule {}
