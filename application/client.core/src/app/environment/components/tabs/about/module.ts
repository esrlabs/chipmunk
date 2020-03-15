import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { ScrollingModule                        } from '@angular/cdk/scrolling';

import { TabAboutComponent                      } from './component';

import {
    ComplexModule,
    PrimitiveModule,
    ContainersModule                            } from 'chipmunk-client-material';

import {
    MatFormField,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    MatProgressBarModule } from '@angular/material';
import {
    FormsModule,
    ReactiveFormsModule } from '@angular/forms';

const entryComponents = [ TabAboutComponent, MatFormField ];
const components = [ TabAboutComponent ];

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
        MatProgressBarModule
    ],
    declarations    : [ ...components ],
    exports         : [ ...components ]
})

export class TabAboutModule {
    constructor() {
    }
}

