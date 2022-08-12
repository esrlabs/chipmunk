import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@elements/containers/module';
import { AppDirectiviesModule } from '@directives/module';
import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatOptionModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ObserveList } from './component';
import { MatCardModule } from '@angular/material/card';
import { TransportReviewModule } from '@ui/elements/transport/listed/module';
import { TransportDetailsModule } from '@ui/elements/transport/details/module';

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
        TransportDetailsModule,
        MatCardModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class ObserveListModule {}
