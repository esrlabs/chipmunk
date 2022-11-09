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
                              { role: 'about' },
                              { type: 'separator' },
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
                                label: 'Open Any File',
                                click: async () => {
                                    /* todo */
                                },
                            },
                            {
                                label: 'Open DLT File',
                                click: async () => {
                                    /* todo */
                                },
                            },
                            {
                                label: 'Open PCAP File',
                                click: async () => {
                                    /* todo */
                                },
                            },
                        ],
                    },
                    {
                        label: 'Folders',
                        submenu: [
                            {
                                label: 'Concat Files',
                                click: async () => {
                                    /* todo */
                                },
                            },
                            {
                                label: 'Merge Files',
                                click: async () => {
                                    /* todo */
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
                                    /* todo */
                                },
                            },
                            {
                                label: 'DLT Streaming',
                                click: async () => {
                                    /* todo */
                                },
                            },
                        ],
                    },
                    { type: 'separator' },
                    {
                        label: 'Sources',
                        submenu: [
                            {
                                label: 'Stdout',
                                click: async () => {
                                    /* todo */
                                },
                            },
                            {
                                label: 'Serial',
                                click: async () => {
                                    /* todo */
                                },
                            },
                            {
                                label: 'TCP Connection',
                                click: async () => {
                                    /* todo */
                                },
                            },
                            {
                                label: 'UDP Connection',
                                click: async () => {
                                    /* todo */
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
                    this.isMac ? { role: 'close' } : { role: 'quit' },
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
