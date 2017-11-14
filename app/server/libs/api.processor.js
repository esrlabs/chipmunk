const Signature             = 'APIProcessor';
const APICommandInterface   = require('./api.command.interface.js');
const APICommands           = require('./api.commands.js');

class APIProcessor {
    constructor (post, response){
        this.post       = post;
        this.response   = response;
        this.commands   = new APICommands();
    }

    getErrors(){
        let errors = [];
        Object.keys(APICommandInterface).forEach((key)=>{
            let target = this.post[key];
            if (typeof APICommandInterface[key].parser === 'function'){
                try{
                    target          = APICommandInterface[key].parser(target);
                    this.post[key]  = target;
                }catch (e){
                    errors.push(new Error('[' + Signature + ']:: error during parsing - [' + key + ']: ' + e.message));
                }
            }
            if (!APICommandInterface[key].canBeMissed && target === void 0){
                errors.push(new Error('[' + Signature + ']:: missed argument in request - [' + key + ']'));
            } else if (target === void 0) {
                //Do nothing
            } else if (!APICommandInterface[key].canBeNull && target === null){
                errors.push(new Error('[' + Signature + ']:: argument [' + key + '] cannot be null'));
            } else if (!APICommandInterface[key].canBeEmpty && typeof target === 'string' && target.trim() === ''){
                errors.push(new Error('[' + Signature + ']:: argument [' + key + '] cannot be empty'));
            } else if (target !== null && !~APICommandInterface[key].type.indexOf(typeof target)){
                errors.push(new Error('[' + Signature + ']:: argument [' + key + '] has wrong type. Expect: ' + APICommandInterface[key].type.join(', ')));
            } else {
                //Exit point
            }
        });
        return errors.length === 0 ? false : errors;
    }

    proceed (callback){
        let errors = this.getErrors();
        if (errors instanceof Array){
            //Returns error
            callback(null, errors);
        } else if(this.commands[this.post.command] === void 0){
            //Command isn't supported. Returns error
            callback(null, [new Error('[' + Signature + ']:: cannot find handle for command [' + this.post.command + '].')]);
        } else {
            //Execute command
            this.commands[this.post.command](this.post, this.response, callback);
        }
    }
};

module.exports = APIProcessor;
