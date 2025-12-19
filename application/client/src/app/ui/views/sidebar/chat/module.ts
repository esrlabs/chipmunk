import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { Chat } from './component';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        MatMenuModule,
        MatIconModule,
        MatDividerModule,
    ],
    declarations: [Chat],
    exports: [Chat],
})
export class ChatModule {}