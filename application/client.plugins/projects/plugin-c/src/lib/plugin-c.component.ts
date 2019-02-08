import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'lib-plugin-c',
  template: `
    <p>
      plugin-c works!
    </p>
    <lib-plugin-c-com></lib-plugin-c-com>
  `,
  styles: []
})
export class PluginCComponent implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
