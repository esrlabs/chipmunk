import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@elements/containers/module';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FilterInputModule } from '@elements/filter/module';

import { Favorites } from './component';

const components = [Favorites];
@NgModule({
    imports: [
        CommonModule,
        ContainersModule,
        MatButtonModule,
        MatIconModule,
        FilterInputModule,
        MatProgressBarModule,
    ],
    declarations: [...components],
    exports: [...components],
    bootstrap: [...components]
})
export class FavoritesModule {}
