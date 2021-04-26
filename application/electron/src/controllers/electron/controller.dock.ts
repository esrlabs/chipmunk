import * as path from 'path';

import { exec } from 'child_process';
import { ExecException } from 'node:child_process';
import { app, Menu, MenuItem } from 'electron';

import ServicePath from '../../services/service.paths';
import Logger from '../../tools/env.logger';

export default class ControllerDock {

    private _logger: Logger = new Logger(`ControllerDock`);

    constructor() {
        this._common();
        switch (process.platform) {
            case 'win32':
                this._win();
                break;
            case 'darwin':
                this._mac();
                break;
        }
    }

    private _common() {
        app.setName('Chipmunk');
    }

    private _win() {
        app.setJumpList([]);
        app.setUserTasks([
            {
              program: ServicePath.getLauncher(),
              arguments: '',
              iconPath: path.resolve(ServicePath.getResources(), 'win/chipmunk.ico'),
              iconIndex: 0,
              title: 'New Window',
              description: 'Create a new window'
            }
        ]);
    }

    private _mac() {
        app.dock.setMenu(Menu.buildFromTemplate([
            new MenuItem({
                label: 'New Window',
                click: () => {
                    this._logger.debug(`New instance of chipmunk would be started with: ${ServicePath.getLauncher()}`);
                    exec(ServicePath.getLauncher(), (err: ExecException | null, stdout: string) => {
                        if (err) {
                            this._logger.error(`Fail to start instance of chipmunk due error: ${err.message}`);
                        } else {
                            this._logger.debug(`New instance of chipmunk is started.`);
                        }
                    });
                },
            })
        ]));
    }
}