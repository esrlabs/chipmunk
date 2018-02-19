import { ToolBarButton      } from './class.toolbar.button';

class StaticTopBarButtonsStorage{
    private shortcuts : Array<ToolBarButton> = [];

    constructor(){
    }

    getItems() : Array<ToolBarButton>{
        return this.shortcuts;
    }

    addButton(button: ToolBarButton | Array<ToolBarButton>){
        if (button instanceof Array){
            this.shortcuts.push(...button);
        } else {
            this.shortcuts.push(button);
        }
    }

    removeButton(id: string | number | symbol){
        let index = this.shortcuts.findIndex(button => (button.id === id));
        ~index && this.shortcuts.splice(index, 1);
    }

    updateButton(button: ToolBarButton){
        let index = this.shortcuts.findIndex(_button => (_button.id === button.id));
        if (~index){
            Object.keys(button).forEach((key: string) => {
                this.shortcuts[index][key] = button[key];
            });
        }
    }

}

let staticTopBarButtonsStorage = new StaticTopBarButtonsStorage();

export { staticTopBarButtonsStorage, StaticTopBarButtonsStorage }
