import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Preview } from './component';
import { Preview as ImagePreview } from './image/component';
import { Preview as TextPreview } from './text/component';
import { Preview as UnknownPreview } from './unknown/component';
import { Preview as VideoPreview } from './video/component';
import { Preview as AudioPreview } from './audio/component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AppDirectiviesModule } from '@directives/module';

@NgModule({
    imports: [CommonModule, MatButtonModule, MatIconModule, AppDirectiviesModule],
    declarations: [Preview, ImagePreview, VideoPreview, AudioPreview, TextPreview, UnknownPreview],
    exports: [Preview],
})
export class PreviewModule {}
