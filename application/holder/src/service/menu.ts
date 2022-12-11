import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from 'platform/entity/service';
import { services } from '@register/services';
import { cli } from '@service/cli';
import { app, Menu, MenuItem } from 'electron';
import { notifications } from '@service/notifications';
import { unique } from 'platform/env/sequence';
import { FileType } from 'platform/types/files';
import { ParserName } from 'platform/types/observe';
import { Source } from 'platform/types/transport';

import * as Actions from './actions';

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
                          label: app.name,
                          submenu: [
                              { role: 'services' },
                              { type: 'separator' },
                              { role: 'hide' },
                              { role: 'hideOthers' },
                              { role: 'unhide' },
                              { type: 'separator' },
                              { role: 'quit' },
                          ],
                      },
                  ]
                : []),
            {
                label: 'File',
                submenu: [
                    {
                        label: 'Files',
                        submenu: [
                            {
                                label: 'Open Any File(s)',
                                click: async () => {
                                    Actions.openFile(FileType.Any).catch((err: Error) => {
                                        this.log().error(
                                            `Fail call action OpenFile: ${err.message}`,
                                        );
                                    });
                                },
                            },
                            {
                                label: 'Open DLT File(s)',
                                click: async () => {
                                    Actions.openFile(FileType.Dlt).catch((err: Error) => {
                                        this.log().error(
                                            `Fail call action OpenFile: ${err.message}`,
                                        );
                                    });
                                },
                            },
                            {
                                label: 'Open PCAP File(s)',
                                click: async () => {
                                    Actions.openFile(FileType.Pcap).catch((err: Error) => {
                                        this.log().error(
                                            `Fail call action OpenFile: ${err.message}`,
                                        );
                                    });
                                },
                            },
                        ],
                    },
                    {
                        label: 'Folders',
                        submenu: [
                            {
                                label: 'Concat Any Files',
                                click: async () => {
                                    Actions.openFolder(FileType.Any).catch((err: Error) => {
                                        this.log().error(
                                            `Fail call action OpenFolder: ${err.message}`,
                                        );
                                    });
                                },
                            },
                            {
                                label: 'Concat DLT Files',
                                click: async () => {
                                    Actions.openFolder(FileType.Dlt).catch((err: Error) => {
                                        this.log().error(
                                            `Fail call action OpenFolder: ${err.message}`,
                                        );
                                    });
                                },
                            },
                            {
                                label: 'Concat PCAP Files',
                                click: async () => {
                                    Actions.openFolder(FileType.Pcap).catch((err: Error) => {
                                        this.log().error(
                                            `Fail call action OpenFolder: ${err.message}`,
                                        );
                                    });
                                },
                            },
                        ],
                    },
                    { type: 'separator' },
                    {
                        label: 'Streaming',
                        submenu: [
                            {
                                label: 'Text Streaming',
                                click: async () => {
                                    Actions.stream(ParserName.Text).catch((err: Error) => {
                                        this.log().error(`Fail call action Stream: ${err.message}`);
                                    });
                                },
                            },
                            {
                                label: 'DLT Streaming',
                                click: async () => {
                                    Actions.stream(ParserName.Dlt).catch((err: Error) => {
                                        this.log().error(`Fail call action Stream: ${err.message}`);
                                    });
                                },
                            },
                            { type: 'separator' },
                            {
                                label: 'DLT on UDP',
                                click: async () => {
                                    Actions.stream(ParserName.Dlt, Source.Udp).catch(
                                        (err: Error) => {
                                            this.log().error(
                                                `Fail call action Stream: ${err.message}`,
                                            );
                                        },
                                    );
                                },
                            },
                            {
                                label: 'DLT on TCP',
                                click: async () => {
                                    Actions.stream(ParserName.Dlt, Source.Tcp).catch(
                                        (err: Error) => {
                                            this.log().error(
                                                `Fail call action Stream: ${err.message}`,
                                            );
                                        },
                                    );
                                },
                            },
                            {
                                label: 'DLT on Serial Port',
                                click: async () => {
                                    Actions.stream(ParserName.Dlt, Source.Serial).catch(
                                        (err: Error) => {
                                            this.log().error(
                                                `Fail call action Stream: ${err.message}`,
                                            );
                                        },
                                    );
                                },
                            },
                            { type: 'separator' },
                            {
                                label: 'Read from Serial Port',
                                click: async () => {
                                    Actions.stream(ParserName.Text, Source.Serial).catch(
                                        (err: Error) => {
                                            this.log().error(
                                                `Fail call action Stream: ${err.message}`,
                                            );
                                        },
                                    );
                                },
                            },
                            {
                                label: 'Read from Stdout',
                                click: async () => {
                                    Actions.stream(ParserName.Text, Source.Process).catch(
                                        (err: Error) => {
                                            this.log().error(
                                                `Fail call action Stream: ${err.message}`,
                                            );
                                        },
                                    );
                                },
                            },
                        ],
                    },
                    { type: 'separator' },
                    {
                        label: 'Preferences',
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
                                                      this.log().warn(`CLI setup is done.`);
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
                                                                  handler: () => Promise.resolve(),
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
                                                                  handler: () => Promise.resolve(),
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
                                    /* todo */
                                },
                            },
                        ],
                    },
                    { type: 'separator' },
                    {
                        label: 'About',
                        click: async () => {
                            Actions.about().catch((err: Error) => {
                                this.log().error(`Fail call action About: ${err.message}`);
                            });
                        },
                    },
                    { type: 'separator' },
                    this.isMac ? { role: 'close' } : { role: 'quit' },
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
                ],
            },
            {
                label: 'View',
                submenu: [
                    { role: 'reload' },
                    { role: 'forceReload' },
                    { role: 'toggleDevTools' },
                    { type: 'separator' },
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
