import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NotificationsComponent } from './component';
import { NotificationComponent } from './notification/component';

import { PrimitiveModule, ContainersModule } from 'chipmunk-client-material';

import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

const entryComponents = [NotificationComponent];
const components = [NotificationsComponent, ...entryComponents];

@NgModule({
    entryComponents: [...entryComponents],
    imports: [
        CommonModule,
        PrimitiveModule,
        ContainersModule,
        MatSnackBarModule,
        MatIconModule,
        MatButtonModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class NotificationsModule {
    constructor() {}
}
