import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@elements/containers/module';
import { MatButtonModule } from '@angular/material/button';
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
        MatButtonModule,
        TransportReviewModule,
        TransportDetailsModule,
        MatCardModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class ObserveListModule {}
