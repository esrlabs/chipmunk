import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContainersModule } from '@elements/containers/module';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { TeamWork } from './component';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';
import { RepositoryModule } from './repository/module';
import { MatInputModule } from '@angular/material/input';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

const entryComponents = [TeamWork];
const components = [...entryComponents];

@NgModule({
    imports: [
        CommonModule,
        ContainersModule,
        MatButtonModule,
        MatCardModule,
        MatExpansionModule,
        MatMenuModule,
        MatIconModule,
        MatDividerModule,
        MatSelectModule,
        RepositoryModule,
        MatInputModule,
        MatCheckboxModule,
        FormsModule,
        ReactiveFormsModule,
    ],
    declarations: [...components],
    exports: [...components],
})
export class TeamWorkModule {}
