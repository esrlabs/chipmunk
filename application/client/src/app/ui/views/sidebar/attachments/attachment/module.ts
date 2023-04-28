import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Item } from './component';
import { Preview as ImagePreview } from './previews/image/component';
import { Preview as TextPreview } from './previews/text/component';
import { Preview as UnknownPreview } from './previews/unknown/component';
import { Preview as VideoPreview } from './previews/video/component';
import { Preview as AudioPreview } from './previews/audio/component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AppDirectiviesModule } from '@directives/module';

const entryComponents = [
    Item,
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
export class ItemModule {}
