const { app, Menu }         = require('electron');
const logger                = new (require('../server/libs/tools.logger'))('ApplicationMenu');
const util                  = require('util');
const ServerEmitter         = require('../server/libs/server.events');
const OutgoingWSCommands    = require('../server/libs/websocket.commands.processor.js');


class ClickHandlers {

    exit(){
        app.quit();
    }
}

class ApplicationMenu {

    constructor(){
        this.menu = Menu;
        this.applicationMenu = require('../client/app/config/menu.json');
        this.clickHandlers = new ClickHandlers();
    }

    create(){
        let template = [];
        if (typeof this.applicationMenu === 'object' && this.applicationMenu !== null && this.applicationMenu.desktop instanceof Array){
            this.applicationMenu.desktop.forEach((group) => {
                if (typeof group.group === 'string' && group.items instanceof Array) {
                    template.push({
                        label   : group.group,
                        submenu : group.items.map((item) => {
                            return item.type === 'line' ?
                                { type: "separator" } :
                                { label: item.caption, accelerator: item.accelerator, click: this._getHandler(item), selector: this._getSelector(item) };
                        })
                    });
                }
            });
        }
        this.menu.setApplicationMenu(
            this.menu.buildFromTemplate(template)
        );
    }

    _getHandler(item){
        if (item.handler !== void 0) {
            return function (handler) {
                ServerEmitter.emitter.emit(ServerEmitter.EVENTS.SEND_VIA_WS, '*', OutgoingWSCommands.COMMANDS.CallMenuItem, {
                    handler: handler
                })
            }.bind(this, item.handler);
        } else if (item.click !== void 0 && this.clickHandlers[item.click] !== void 0) {
            return this.clickHandlers[item.click];
        }
    }

    _getSelector(item){
        return typeof item.selector === 'string' ? item.selector : '';
    }

}

module.exports = ApplicationMenu;
