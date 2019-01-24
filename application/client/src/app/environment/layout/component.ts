import { Component } from '@angular/core';
import { TabsService } from '../components/complex/tabs/service';
import { DockingComponent } from '../components/complex/docking/component';
import { DockDef, DocksService } from '../components/complex/docking/service';

@Component({
    selector: 'app-layout',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutComponent {

    public tabService: TabsService = new TabsService();

    constructor() {
        this.tabService.add({
            name: 'Tab 1 (3)',
            active: true,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Dock({ caption: 'Dock 1' }),
                        b: new DockDef.Container({
                            a: new DockDef.Dock({ caption: 'Dock 2' }),
                            b: new DockDef.Dock({ caption: 'Dock 3' })
                        })
                    }))
                }
            }
        });
        this.tabService.add({
            name: 'Tab 2 (2)',
            active: false,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Dock({ caption: 'Dock 1' }),
                        b: new DockDef.Dock({ caption: 'Dock 2' })
                    }))
                }
            }
        });
        this.tabService.add({
            name: 'Tab 3 (4)',
            active: false,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Container({
                            a: new DockDef.Dock({ caption: '1' }),
                            b: new DockDef.Dock({ caption: '2' })
                        }),
                        b: new DockDef.Container({
                            a: new DockDef.Dock({ caption: '3' }),
                            b: new DockDef.Dock({ caption: '4' })
                        })
                    }))
                }
            }
        });
        this.tabService.add({
            name: 'Tab 4 (5)',
            active: false,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Container({
                            a: new DockDef.Dock({ caption: 'Dock 1' }),
                            b: new DockDef.Dock({ caption: 'Dock 2' })
                        }),
                        b: new DockDef.Container({
                            a: new DockDef.Dock({ caption: 'Dock 3' }),
                            b: new DockDef.Container({
                                a: new DockDef.Dock({ caption: 'Dock 4' }),
                                b: new DockDef.Dock({ caption: 'Dock 5' })
                            })
                        })
                    }))
                }
            }
        });
        this.tabService.add({
            name: 'Tab 5',
            active: false,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Dock({ caption: 'Dock 1' })
                    }))
                }
            }
        });
        /*
        this.service.add({
            name: 'Tab 1 (3)',
            active: true,
            dock: new DockDef.Container({
              a: new DockDef.Dock({ caption: 'Dock 1' }),
              b: new DockDef.Container({
                a: new DockDef.Dock({ caption: 'Dock 2' }),
                b: new DockDef.Dock({ caption: 'Dock 3' })
              })
            })
          });
          this.service.add({
            name: 'Tab 2 (2)',
            active: false,
            dock: new DockDef.Container({
              a: new DockDef.Dock({ caption: 'Dock 1' }),
              b: new DockDef.Dock({ caption: 'Dock 2' })
            })
          });
          this.service.add({
            name: 'Tab 3 (4)',
            active: false,
            dock: new DockDef.Container({
              a: new DockDef.Container({
                a: new DockDef.Dock({ caption: '1' }),
                b: new DockDef.Dock({ caption: '2' })
              }),
              b: new DockDef.Container({
                a: new DockDef.Dock({ caption: '3' }),
                b: new DockDef.Dock({ caption: '4' })
              })
            })
          });
          this.service.add({
            name: 'Tab 4 (5)',
            active: false,
            dock: new DockDef.Container({
              a: new DockDef.Container({
                a: new DockDef.Dock({ caption: 'Dock 1' }),
                b: new DockDef.Dock({ caption: 'Dock 2' })
              }),
              b: new DockDef.Container({
                a: new DockDef.Dock({ caption: 'Dock 3' }),
                b: new DockDef.Container({
                  a: new DockDef.Dock({ caption: 'Dock 4' }),
                  b: new DockDef.Dock({ caption: 'Dock 5' })
                })
              })
            })
          });
          this.service.add({
            name: 'Tab 5 (1)',
            active: false,
            dock: new DockDef.Container({
              a: new DockDef.Dock({ caption: 'Dock 1' })
            })
          });
          */

    }

}
