import { Subject, Observable } from 'rxjs';
import { IPCMessages } from '../../../services/service.electron.ipc';

export interface IIconButton {
    title: string;
    handler: (event: MouseEvent) => void;
    cssClass: string;
    id: string;
}

export class TabTitleContentService {

    private _subject: {
        addIconButton: Subject<IIconButton>,
        removeIconButton: Subject<string>,
    } = {
        addIconButton: new Subject(),
        removeIconButton: new Subject(),
    };
    private _icons: IIconButton[] = [];
    private _stream: string;

    constructor(stream: string) {
        this._stream = stream;
    }

    public getObservable(): {
        addIconButton: Observable<IIconButton>,
        removeIconButton: Observable<string>,
    } {
        return {
            addIconButton: this._subject.addIconButton,
            removeIconButton: this._subject.removeIconButton,
        };
    }


    public getIconButtons(): IIconButton[] {
        return this._icons.map((icon: IIconButton) => {
            return Object.assign({}, icon);
        });
    }

    public addIconButton(button: IIconButton): void {
        this._icons.push(Object.assign({}, button));
        this._subject.addIconButton.next(button);
    }

    public removeIconButton(id: string): void {
        this._icons = this._icons.filter((icon: IIconButton) => {
            return icon.id !== id;
        });
        this._subject.removeIconButton.next(id);
    }

}
