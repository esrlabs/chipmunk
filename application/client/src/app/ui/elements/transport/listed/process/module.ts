import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TransportProcess } from './component';

@NgModule({
    entryComponents: [TransportProcess],
    imports: [CommonModule, MatButtonModule, MatIconModule],
    declarations: [TransportProcess],
    exports: [TransportProcess],
})
export class TransportReviewProcessModule {}
