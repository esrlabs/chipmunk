import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { ScrollingModule                        } from '@angular/cdk/scrolling';
import { HttpClient                             } from '@angular/common/http';
import { HttpClientModule                       } from '@angular/common/http';

import { TabReleaseNotesComponent               } from './component';

import {
    ComplexModule,
    PrimitiveModule,
    ContainersModule                            } from 'chipmunk-client-material';

import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormField, MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import {
    FormsModule,
    ReactiveFormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown';

const entryComponents = [ TabReleaseNotesComponent, MatFormField ];
const components = [ TabReleaseNotesComponent ];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [
        CommonModule,
        ScrollingModule,
        PrimitiveModule,
        ContainersModule,
        ComplexModule,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatButtonModule,
        MatIconModule,
        MatExpansionModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MarkdownModule.forRoot({ loader: HttpClient }),
    ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class TabReleaseNotesModule {
    constructor() {
    }
}

