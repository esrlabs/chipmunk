import { Component, Input } from '@angular/core';

@Component({
    selector: 'lib-plugin-c-item',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class PluginCItemComponent {
  @Input() text = 'text';

}
