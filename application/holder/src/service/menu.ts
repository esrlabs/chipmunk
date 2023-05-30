import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from 'platform/entity/service';
import { services } from '@register/services';
import { cli } from '@service/cli';
import { Menu, MenuItem } from 'electron';
import { notifications } from '@service/notifications';
import { unique } from 'platform/env/sequence';
import { FileType } from 'platform/types/files';
import { ParserName } from 'platform/types/observe';
import { Source } from 'platform/types/transport';
import { ChipmunkGlobal } from '@register/global';

import * as Actions from './actions';

declare const global: ChipmunkGlobal;

@DependOn(notifications)
@DependOn(cli)
@SetupService(services['menu'])
export class Service extends Implementation {
    protected readonly isMac: boolean = process.platform === 'darwin';

    public override ready(): Promise<void> {
        this.update().catch((err: Error) => {
            this.log().error(`Fail to update/init application menu: ${err.message}`);
        });
        return Promise.resolve();
    }

    public async update(): Promise<void> {
        const menu = Menu.buildFromTemplate(await this.generate());
        Menu.setApplicationMenu(menu);
    }

    protected async generate(): Promise<MenuItem[]> {
        const cliSupported = await cli.support().available();
        const cliInstalled = await cli.support().exists();
        return [
            ...(this.isMac
                ? [
                      {
                          label: `Chipmunk`,
                          submenu: [
                              { role: 'services' },
                              { type: 'separator' },
                              { role: 'hide' },
                              { role: 'hideOthers' },
                              { role: 'unhide' },
                              { type: 'separator' },
                              {
                                  label: 'Settings',
                                  submenu: [
                                      ...(cliSupported
                                          ? [
                                                {
                                                    label: cliInstalled
                                                        ? 'Remove CLI support'
                                                        : 'Setup CLI support',
                                                    click: () => {
                                                        cli.support()
                                                            .toggle()
                                                            .then(() => {
                                                                this.log().warn(
                                                                    `CLI setup is done.`,
                                                                );
                                                                notifications.send(
                                                                    cliInstalled
                                                                        ? `Support of CLI was successfully removed`
                                                                        : `CLI support was successfuly added`,
                                                                    [
                                                                        {
                                                                            action: {
                                                                                uuid: unique(),
                                                                                name: 'Ok',
                                                                                description: ``,
                                                                            },
                                                                            handler: () =>
                                                                                Promise.resolve(),
                                                                        },
                                                                    ],
                                                                );
                                                            })
                                                            .catch((err: Error) => {
                                                                this.log().warn(
                                                                    `Fail to setup CLI: ${err.message}`,
                                                                );
                                                                notifications.send(
                                                                    cliInstalled
                                                                        ? `Fail to remove CLI support: ${err.message}`
                                                                        : `Fail to add CLI support: ${err.message}`,
                                                                    [
                                                                        {
                                                                            action: {
                                                                                uuid: unique(),
                                                                                name: 'Ok',
                                                                                description: ``,
                                                                            },
                                                                            handler: () =>
                                                                                Promise.resolve(),
                                                                        },
                                                                    ],
                                                                );
                                                            })
                                                            .finally(() => {
                                                                this.update();
                                                            });
                                                    },
                                                },
                                                { type: 'separator' },
                                            ]
                                          : []),
                                      {
                                          label: 'Settings',
                                          click: async () => {
                                              Actions.settings().catch((err: Error) => {
                                                  this.log().error(
                                                      `Fail call action About: ${err.message}`,
                                                  );
                                              });
                                          },
                                      },
                                  ],
                              },
                              { type: 'separator' },
                              {
                                  label: 'Check for updates',
                                  click: async () => {
                                      Actions.updates().catch((err: Error) => {
                                          this.log().error(
                                              `Fail call action About: ${err.message}`,
                                          );
                                      });
                                  },
                              },
                              { type: 'separator' },
                              {
                                  label: 'About',
                                  click: async () => {
                                      Actions.about().catch((err: Error) => {
                                          this.log().error(
                                              `Fail call action About: ${err.message}`,
                                          );
                                      });
                                  },
                              },
                              { type: 'separator' },
                              {
                                  label: 'Developing',
                                  submenu: [
                                      { role: 'reload' },
                                      { role: 'forceReload' },
                                      { role: 'toggleDevTools' },
                                  ],
                              },

                              { type: 'separator' },
                              {
                                  label: this.isMac ? 'Quit' : 'Close',
                                  registerAccelerator: false,
                                  accelerator: 'CommandOrControl + Q',
                                  click: () => {
                                      global.application
                                          .shutdown('ClosingWithMenu')
                                          .close()
                                          .catch((err: Error) => {
                                              this.log().error(`Fail to close: ${err.message}`);
                                          });
                                  },
                              },
                          ],
                      },
                  ]
                : []),
            ...(!this.isMac
                ? [
                      {
                          label: `Chipmunk`,
                          submenu: [
                              {
                                  label: 'Settings',
                                  submenu: [
                                      ...(cliSupported
                                          ? [
                                                {
                                                    label: cliInstalled
                                                        ? 'Remove CLI support'
                                                        : 'Setup CLI support',
                                                    click: () => {
                                                        cli.support()
                                                            .toggle()
                                                            .then(() => {
                                                                this.log().warn(
                                                                    `CLI setup is done.`,
                                                                );
                                                                notifications.send(
                                                                    cliInstalled
                                                                        ? `Support of CLI was successfully removed`
                                                                        : `CLI support was successfuly added`,
                                                                    [
                                                                        {
                                                                            action: {
                                                                                uuid: unique(),
                                                                                name: 'Ok',
                                                                                description: ``,
                                                                            },
                                                                            handler: () =>
                                                                                Promise.resolve(),
                                                                        },
                                                                    ],
                                                                );
                                                            })
                                                            .catch((err: Error) => {
                                                                this.log().warn(
                                                                    `Fail to setup CLI: ${err.message}`,
                                                                );
                                                                notifications.send(
                                                                    cliInstalled
                                                                        ? `Fail to remove CLI support: ${err.message}`
                                                                        : `Fail to add CLI support: ${err.message}`,
                                                                    [
                                                                        {
                                                                            action: {
                                                                                uuid: unique(),
                                                                                name: 'Ok',
                                                                                description: ``,
                                                                            },
                                                                            handler: () =>
                                                                                Promise.resolve(),
                                                                        },
                                                                    ],
                                                                );
                                                            })
                                                            .finally(() => {
                                                                this.update();
                                                            });
                                                    },
                                                },
                                                { type: 'separator' },
                                            ]
                                          : []),
                                      {
                                          label: 'Settings',
                                          click: async () => {
                                              Actions.settings().catch((err: Error) => {
                                                  this.log().error(
                                                      `Fail call action About: ${err.message}`,
                                                  );
                                              });
                                          },
                                      },
                                  ],
                              },
                              { type: 'separator' },
                              {
                                  label: 'Check for updates',
                                  click: async () => {
                                      Actions.updates().catch((err: Error) => {
                                          this.log().error(
                                              `Fail call action About: ${err.message}`,
                                          );
                                      });
                                  },
                              },
                              { type: 'separator' },
                              {
                                  label: 'About',
                                  click: async () => {
                                      Actions.about().catch((err: Error) => {
                                          this.log().error(
                                              `Fail call action About: ${err.message}`,
                                          );
                                      });
                                  },
                              },
                              { type: 'separator' },
                              {
                                  label: 'Developing',
                                  submenu: [
                                      { role: 'reload' },
                                      { role: 'forceReload' },
                                      { role: 'toggleDevTools' },
                                  ],
                              },
                              { type: 'separator' },
                              {
                                  label: this.isMac ? 'Quit' : 'Close',
                                  registerAccelerator: false,
                                  accelerator: 'CommandOrControl + Q',
                                  click: () => {
                                      global.application
                                          .shutdown('ClosingWithMenu')
                                          .close()
                                          .catch((err: Error) => {
                                              this.log().error(`Fail to close: ${err.message}`);
                                          });
                                  },
                              },
                          ],
                      },
                  ]
                : []),
            {
                label: 'File',
                submenu: [
                    {
                        label: 'Open File(s)',
                        click: async () => {
                            Actions.openFile(FileType.Any).catch((err: Error) => {
                                this.log().error(`Fail call action OpenFile: ${err.message}`);
                            });
                        },
                    },
                    { type: 'separator' },
                    {
                        label: 'Concat',
                        submenu: [
                            {
                                label: 'Files',
                                click: async () => {
                                    Actions.openFile(FileType.Any).catch((err: Error) => {
                                        this.log().error(
                                            `Fail call action openFile: ${err.message}`,
                                        );
                                    });
                                },
                            },
                            {
                                label: 'Folder(s)',
                                click: async () => {
                                    Actions.openFolder(FileType.Any).catch((err: Error) => {
                                        this.log().error(
                                            `Fail call action OpenFolder: ${err.message}`,
                                        );
                                    });
                                },
                            },
                            { type: 'separator' },
                            {
                                label: 'Select Files from Folder',
                                submenu: [
                                    {
                                        label: 'DLT',
                                        click: async () => {
                                            Actions.openFolder(FileType.Dlt).catch((err: Error) => {
                                                this.log().error(
                                                    `Fail call action openFile: ${err.message}`,
                                                );
                                            });
                                        },
                                    },
                                    {
                                        label: 'PCAPNG',
                                        click: async () => {
                                            Actions.openFolder(FileType.PcapNG).catch(
                                                (err: Error) => {
                                                    this.log().error(
                                                        `Fail call action openFile: ${err.message}`,
                                                    );
                                                },
                                            );
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            {
                label: 'Connections',
                submenu: [
                    {
                        label: 'DLT on UDP',
                        click: async () => {
                            Actions.stream(ParserName.Dlt, Source.Udp).catch((err: Error) => {
                                this.log().error(`Fail call action Stream: ${err.message}`);
                            });
                        },
                    },
                    {
                        label: 'DLT on TCP',
                        click: async () => {
                            Actions.stream(ParserName.Dlt, Source.Tcp).catch((err: Error) => {
                                this.log().error(`Fail call action Stream: ${err.message}`);
                            });
                        },
                    },
                    {
                        label: 'DLT on Serial Port',
                        click: async () => {
                            Actions.stream(ParserName.Dlt, Source.Serial).catch((err: Error) => {
                                this.log().error(`Fail call action Stream: ${err.message}`);
                            });
                        },
                    },
                    { type: 'separator' },
                    {
                        label: 'Plain text Serial Port',
                        click: async () => {
                            Actions.stream(ParserName.Text, Source.Serial).catch((err: Error) => {
                                this.log().error(`Fail call action Stream: ${err.message}`);
                            });
                        },
                    },
                    { type: 'separator' },
                    {
                        label: 'Select Source for Plain text',
                        click: async () => {
                            Actions.stream(ParserName.Text).catch((err: Error) => {
                                this.log().error(`Fail call action Stream: ${err.message}`);
                            });
                        },
                    },
                    {
                        label: 'Select Source for DLT',
                        click: async () => {
                            Actions.stream(ParserName.Dlt).catch((err: Error) => {
                                this.log().error(`Fail call action Stream: ${err.message}`);
                            });
                        },
                    },
                ],
            },
            {
                label: 'Terminal',
                submenu: [
                    {
                        label: 'Execute command',
                        click: async () => {
                            Actions.stream(ParserName.Text, Source.Process).catch((err: Error) => {
                                this.log().error(`Fail call action Stream: ${err.message}`);
                            });
                        },
                    },
                ],
            },
            {
                label: 'Edit',
                submenu: [
                    { role: 'undo' },
                    { role: 'redo' },
                    { type: 'separator' },
                    { role: 'cut' },
                    { role: 'copy' },
                    { role: 'paste' },
                    { type: 'separator' },
                    { role: 'selectAll' },
                ],
            },
            {
                label: 'View',
                submenu: [
                    { role: 'resetZoom' },
                    { role: 'zoomIn' },
                    { role: 'zoomOut' },
                    { type: 'separator' },
                    { role: 'togglefullscreen' },
                ],
            },
            {
                label: 'Window',
                submenu: [
                    { role: 'minimize' },
                    { role: 'zoom' },
                    ...(this.isMac
                        ? [
                              { type: 'separator' },
                              { role: 'front' },
                              { type: 'separator' },
                              { role: 'window' },
                          ]
                        : [{ role: 'close' }]),
                ],
            },
        ] as unknown as MenuItem[];
    }
}
export interface Service extends Interface {}
export const menu = register(new Service());
