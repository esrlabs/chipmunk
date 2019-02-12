import { Component } from '@angular/core';

@Component({
  selector: 'app-plugin-a',
  templateUrl: './template.html',
  styleUrls: ['./styles.less']
})

export class PluginAComponent {

    public _items: string[] = ['fsdfsdfsd', 'fdsdfsdfsd'];

    constructor() {
        for (let i = 50; i >= 0; i -= 1) {
            this._items.push((new Date()).getTime().toString());
        }
        // console.log(this._items);
    }

}
