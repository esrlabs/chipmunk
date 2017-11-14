import { Button         } from './interface.button';
import { TitleButton    } from './interface.titlebutton';
import { Settings       } from './interface.settings';
import { Content        } from './interface.content';

interface Parameters{
    buttons?        : Array<Button>,
    titlebuttons?   : Array<TitleButton>,
    content         : Content,
    title?          : string,
    settings?       : Settings,
    GUID            : symbol
}

export { Parameters };