
import {Injectable} from "@angular/core";

import { MenuItem } from './class.menu.item';
import { configuration as Configuration } from '../modules/controller.config';

const MODES = {
    web: 'web',
    desktop: 'desktop'
};

@Injectable()

export class ServiceTopBarMenuItems{

    private mode: string = MODES.web;
    private menu: Array<MenuItem> = [];

    constructor(){
        this.menu = Configuration.sets.MENU.web.map((item: MenuItem) => {
            return Object.assign({}, item);
        });
    }

    getItems() : MenuItem[]{
        switch (this.mode) {
            case MODES.web:
                return this.menu;
            default:
                return [];

        }
    }
}
