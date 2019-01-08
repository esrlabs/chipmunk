import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface IOptions {
    closeDelay?: number;
    closable?: boolean;
}

export interface IButton {
    caption: string;
    handler: (...args: any[]) => any;
}

export interface IComponent {
    factory: any;
    inputs: any;
}

export interface INotification {
    id?: string;
    caption: string;
    message?: string;
    component?: IComponent;
    progress?: boolean;
    buttons?: IButton[];
    options?: IOptions;
    closing?: boolean;
}

@Injectable({ providedIn: 'root' })

export class NotificationsService {

    private subject = new Subject<INotification>();

    add(notification: INotification) {
        this.subject.next(notification);
    }

    clear() {
        this.subject.next();
    }

    getObservable(): Observable<INotification> {
        return this.subject.asObservable();
    }
}
