import { ViewSizeClass      } from './class.view.size';
import { ViewPositionClass  } from './class.view.position';
import { FavoriteItem       } from './class.favorite.item';

export class ViewClass {
    id                  : string;
    GUID                : string;
    name                : string;
    description         : string;
    icon                : string;
    row                 : number;
    column              : number;
    weight              : number;
    vertical            : boolean;
    horizontal          : boolean;
    favorites           : Array<FavoriteItem>;
    menu                : Array<Object>;
    hide?               : Array<string>;
    controller          : any;
    size                : ViewSizeClass;
    position            : ViewPositionClass;
    forceUpdateContent? : Function | null;
    __updated?          : boolean;
}