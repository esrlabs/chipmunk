import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { TeamworkAppletModule } from '@elements/teamwork/module';

import { Comments } from './component';
import { Comment } from './comment/component';
import { Editor } from './editor/component';
import { Reply } from './reply/component';

import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
    imports: [
        CommonModule,
        ScrollingModule,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatExpansionModule,
        MatCardModule,
        MatMenuModule,
        MatDividerModule,
        TeamworkAppletModule,
    ],
    declarations: [Comments, Comment, Editor, Reply],
    exports: [Comments],
})
export class CommentsModule {
    constructor() {}
}
