import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AttachmentsListSelector } from './component';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';

@NgModule({
    entryComponents: [AttachmentsListSelector],
    imports: [CommonModule, MatSelectModule, MatListModule],
    declarations: [AttachmentsListSelector],
    exports: [AttachmentsListSelector],
    bootstrap: [AttachmentsListSelector],
})
export class AttachmentsList {}
