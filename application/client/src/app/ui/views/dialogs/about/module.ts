import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { About } from './component';

@NgModule({
    imports: [CommonModule, MatButtonModule],
    declarations: [About],
    exports: [About],
    bootstrap: [About]
})
export class AboutModule {}
