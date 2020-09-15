import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { ScrollingModule                        } from '@angular/cdk/scrolling';

import { SidebarAppCommentsComponent            } from './component';
import { SidebarAppCommentsItemComponent        } from './comment/component';
import { SidebarAppCommentsEditorComponent      } from './editor/component';

import { PrimitiveModule, ContainersModule      } from 'chipmunk-client-material';

import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';


import {
    FormsModule,
    ReactiveFormsModule } from '@angular/forms';


const entryComponents = [
    SidebarAppCommentsComponent,
    SidebarAppCommentsItemComponent,
    SidebarAppCommentsEditorComponent,
];

const components = [ ...entryComponents ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [
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
        MatTooltipModule,
        MatExpansionModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MatCardModule,
    ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class SidebarAppCommentsModule {
    constructor() {
    }
}
