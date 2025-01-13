import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Repository } from './component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AppDirectiviesModule } from '@directives/module';

@NgModule({
    imports: [CommonModule, MatButtonModule, MatIconModule, AppDirectiviesModule],
    declarations: [Repository],
    exports: [Repository],
})
export class RepositoryModule {}
