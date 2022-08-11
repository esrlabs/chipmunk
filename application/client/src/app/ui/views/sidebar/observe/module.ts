import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@elements/containers/module';
import { AppDirectiviesModule } from '@directives/module';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatOptionModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ObserveList } from './component';
import { TransportReviewModule } from '@elements/transport.review/module';
import { MatCardModule } from '@angular/material/card';

const entryComponents = [ObserveList];
const components = [...entryComponents];

@NgModule({
    entryComponents: [...entryComponents],
    imports: [
        CommonModule,
        ContainersModule,
        AppDirectiviesModule,
        MatIconModule,
        MatAutocompleteModule,
        MatOptionModule,
        MatProgressSpinnerModule,
        TransportReviewModule,
        MatCardModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class ObserveListModule {}
