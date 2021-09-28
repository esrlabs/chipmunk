import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';

import { TabSettingsComponent } from './component';
import { TabSettingsElementComponent } from './element/component';
import { TabSettingsNavigationComponent } from './navigation/component';
import { TabSettingsContentComponent } from './content/component';

import { ComplexModule, PrimitiveModule, ContainersModule } from 'chipmunk-client-material';

import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormField, MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTreeModule } from '@angular/material/tree';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';

const components = [
    TabSettingsComponent,
    TabSettingsElementComponent,
    TabSettingsNavigationComponent,
    TabSettingsContentComponent,
];

const entryComponents = [...components, MatFormField];

@NgModule({
    entryComponents: [...entryComponents],
    imports: [
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
        MatTreeModule,
        MatCheckboxModule,
        MatInputModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class TabSettingsModule {
    constructor() {}
}
