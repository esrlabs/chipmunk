import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';

import { SidebarAppCommentsComponent } from './component';
import { SidebarAppCommentsItemComponent } from './comment/component';
import { SidebarAppCommentsEditorComponent } from './editor/component';
import { SidebarAppCommentsItemReplayComponent } from './replay/component';

import { PrimitiveModule, ContainersModule } from 'chipmunk-client-material';

import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';

const entryComponents = [
    SidebarAppCommentsComponent,
    SidebarAppCommentsItemComponent,
    SidebarAppCommentsEditorComponent,
    SidebarAppCommentsItemReplayComponent,
];

const components = [...entryComponents];

@NgModule({
    entryComponents: [...entryComponents],
    imports: [
        CommonModule,
        ScrollingModule,
        PrimitiveModule,
        ContainersModule,
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
    ],
    declarations: [...components],
    exports: [...components],
})
export class SidebarAppCommentsModule {
    constructor() {}
}
