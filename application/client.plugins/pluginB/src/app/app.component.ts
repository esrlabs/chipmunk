import { Component } from '@angular/core';
import * as PluginC from 'plugin-c';

console.log(PluginC);

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less']
})
export class AppComponent {
  title = 'pluginB';
}
