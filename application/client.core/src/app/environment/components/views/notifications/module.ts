import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';

import { SidebarAppNotificationsComponent } from './component';
import { SidebarAppNotificationComponent } from './notification/component';
import { SidebarAppNotificationsCounterComponent } from './counter/component';
import { SidebarAppNotificationDetailsComponent } from './details/component';

import { PrimitiveModule, ContainersModule } from 'chipmunk-client-material';

import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';

const entryComponents = [
    SidebarAppNotificationsComponent,
    SidebarAppNotificationComponent,
    SidebarAppNotificationsCounterComponent,
    SidebarAppNotificationDetailsComponent,
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
        MatTooltipModule,
        MatExpansionModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class SidebarAppNotificationsModule {
    constructor() {}
}
