import * as path from 'path';

import { app } from 'electron';

import ServicePath from '../../services/service.paths';

export default class ControllerDock {

    constructor() {
        this._common();
        switch (process.platform) {
            case 'win32':
                this._win();
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
}