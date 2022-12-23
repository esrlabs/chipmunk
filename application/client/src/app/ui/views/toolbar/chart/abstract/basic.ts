import { IlcInterface } from '@service/ilc';
import { Session } from '@service/session';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Service } from '../service';

export abstract class BasicState {
    protected _parent!: IlcInterface & ChangesDetector;
    protected _session!: Session;
    protected _service!: Service;
    protected _element!: HTMLElement;

    public bind(
        parent: IlcInterface & ChangesDetector,
        session: Session,
        element: HTMLElement,
    ): void {
        this._parent = parent;
        this._session = session;
        this._element = element;
        this._service = Service.from(this._session);
    }

    protected abstract init(): void;
    protected abstract destroy(): void;
}
