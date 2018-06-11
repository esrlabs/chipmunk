import { Component                              } from '@angular/core';
import { events as Events                       } from '../../modules/controller.events';
import { configuration as Configuration         } from '../../modules/controller.config';
import { GUID                                   } from '../../modules/tools.guid';

import { INotification, INotificationButton, ENotificationTypes } from './interfaces';

const AUTO_CLOSE_NOTIFICATION_DURATION = 10 * 1000; //ms => 10 sec
const CLOSE_ANIMATION_DURATION = 500;

@Component({
    selector    : 'notifications',
    templateUrl : './template.html',
})

export class Notifications {

    private _notifications: Array<INotification> = [];

    constructor(){
        this._addNotification = this._addNotification.bind(this);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.CREATE_NOTIFICATION, this._addNotification);
    }

    ngOnDestroy(){
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.CREATE_NOTIFICATION, this._addNotification);
    }

    _setDefaults(notification: INotification): INotification{
        notification.buttons            = notification.buttons instanceof Array ? notification.buttons : [];
        notification.closable           = typeof notification.closable === 'boolean' ? notification.closable : true;
        notification.addCloseHandler    = typeof notification.addCloseHandler === 'boolean' ? notification.addCloseHandler : true;
        notification.progress           = typeof notification.progress === 'boolean' ? notification.progress : false;
        notification.id                 = typeof notification.id === 'string' ? notification.id : GUID.generate();
        notification.caption            = typeof notification.caption === 'string' ? notification.caption : '';
        notification.message            = typeof notification.message === 'string' ? notification.message : '';
        notification.type               = typeof notification.type === 'string' ? notification.type : ENotificationTypes.info;
        notification._closeTimerId      = -1;
        notification._closing           = false;
        return notification;
    }

    _addCloseHandlers(notification: INotification): INotification{
        if (notification.buttons !== null && notification.addCloseHandler) {
            notification.buttons = notification.buttons.map((button: INotificationButton) => {
                const handler = button.handler;
                button.handler = () => {
                    this._close(notification.id);
                    handler();
                };
                return button;
            });
        }
        return notification;
    }

    _autoClose(notification: INotification): INotification{
        if (notification.closable) {
            notification._closeTimerId = setTimeout(this._close.bind(this, notification.id), AUTO_CLOSE_NOTIFICATION_DURATION);
        }
        return notification;
    }

    _close(id: string){
        this._notifications = this._notifications.map((notification: INotification) => {
            if (notification.id === id) {
                notification._closeTimerId !== -1 && clearTimeout(notification._closeTimerId);
                notification._closing = true;
                setTimeout(this._remove.bind(this, id), CLOSE_ANIMATION_DURATION);
            }
            return notification;
        });
    }

    _remove(id: string){
        this._notifications = this._notifications.filter((notification: INotification) => {
            if (notification.id === id) {
                return false;
            }
            return true;
        });
    }


    _addNotification(notification: INotification){
        if (typeof notification !== 'object' || notification === null) {
            return;
        }
        notification = this._setDefaults(notification);
        notification = this._addCloseHandlers(notification);
        notification = this._autoClose(notification);
        this._notifications.push(notification);
    }


}
