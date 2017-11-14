import { InitiableModule } from '../interfaces/interface.module.initiable';

const LOCALE = '_';

class Locale implements InitiableModule{

    register(){
        window[LOCALE] = this.translate.bind(this);
    }

    init (callback : Function){
        this.register();
        callback();
    }

    translate(str : string = ''){
        return str;
    }
}

let locale = new Locale();

export { locale, LOCALE }

