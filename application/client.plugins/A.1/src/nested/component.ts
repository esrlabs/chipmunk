import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-plugin-a-item',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class PluginAItemComponent {
  @Input() text = 'text';

}
