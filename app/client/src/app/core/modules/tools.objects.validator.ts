class Validator {
    private getNameProtorype(target : any){
        let results = /function (.{1,})\(/.exec(target.constructor.toString());
        return (results && results.length > 1) ? results[1] : "";
    }

    private check(target : Object, scheme : Object){
        let result : any = true;
        Object.keys(scheme).forEach((name)=>{
            if (result){
                target[name] === void 0 && (result = new Error('Property [' + name + '] is not defined.'));
                if (!(result instanceof Error)){
                    if(typeof scheme[name] === 'string'){
                        typeof target[name] !== scheme[name] && (result = new Error('Property [' + name + '] has wrong type. Expected: ' + scheme[name]));
                    } else {
                        Object.getPrototypeOf(target[name]) !== scheme[name] && (result = new Error('Property [' + name + '] has wrong prototype. Expected: [' + this.getNameProtorype(scheme[name]) + ']'));
                    }
                }
            }
        });
        return result;
    }

    validate (target : Object, scheme : Object){
        if (typeof target === 'object' && target !== null){
            if (typeof scheme === 'undefined'){
                return true;
            } else if (typeof scheme === 'object' && scheme !== null){
                return this.check(target, scheme);
            } else {
                return new Error('Scheme is not an object.');
            }
        } else {
            return new Error('Target is not an object.');
        }
    }
}
let validator = new Validator();
export { validator as validator }

