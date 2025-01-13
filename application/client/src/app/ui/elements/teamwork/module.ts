import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@elements/containers/module';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatExpansionModule } from '@angular/material/expansion';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Teamwork } from './component';

@NgModule({
    imports: [
        CommonModule,
        ContainersModule,
        MatFormFieldModule,
        MatSelectModule,
        MatExpansionModule,
        MatButtonModule,
        FormsModule,
        ReactiveFormsModule,
    ],
    declarations: [Teamwork],
    exports: [Teamwork],
})
export class TeamworkAppletModule {}
