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

const entryComponents = [
    Preview,
    ImagePreview,
    VideoPreview,
    AudioPreview,
    TextPreview,
    UnknownPreview,
];
const components = [...entryComponents];

@NgModule({
    imports: [CommonModule, MatButtonModule, MatIconModule, AppDirectiviesModule],
    declarations: [...components],
    exports: [...components],
})
export class PreviewModule {}
