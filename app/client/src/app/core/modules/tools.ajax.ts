const DIRECTIONS = {
    GET     : 'GET',
    POST    : 'POST',
    PUT     : 'PUT',
    DELETE  : 'DELETE',
    OPTION  : 'OPTION'
};

const CALLBACKS = {
    headers : 'headers',
    change  : 'change',
    done    : 'done',
    error   : 'error',
    timeout : 'timeout',
    fail    : 'fail'
};

const HEADERS = {
    CONTENT_TYPE    : 'Content-Type',
    ACCEPT          : 'Accept'
};

const RESPONSE_HEADERS = {
    FILE: 'logviewer-file'
};

class Method{
    private direction : string;
    constructor(direction : string){
        if (DIRECTIONS[direction] === void 0){
            throw new Error('Use one of directions: [' + Object.keys(DIRECTIONS).join(', ') + '].');
        } else {
            this.direction = direction;
        }
    }
    get(){
        return DIRECTIONS[this.direction];
    }
}

class Request{
    public httpRequest          : XMLHttpRequest;
    public method               : Method            = new Method(DIRECTIONS.GET);
    public url                  : string            = '';
    public responseHeaders      : Object            = {};
    public callbacks            : Function | Object = {};
    public response             : any               = null;
    public validator            : Function          = null;
    public parser               : Function          = null;
    public attempts             : number            = 0;
    public requestHeaders       : Object            = {};
    public requestPost          : Object            = {};
    public requestPostParsed    : string            = '';

    constructor({
                   url          = '',
                   method       = new Method(DIRECTIONS.GET),
                   callback     = {},
                   attempts     = 0,
                   validator    = {},
                   headers      = {},
                   post         = {},
                   parser       = {}
                } = {}
    ){
        if (typeof url === 'string' && url !== ''){
            if (method instanceof Method){
                this.httpRequest                    = new XMLHttpRequest();
                this.url                            = url;
                this.method                         = method;
                this.callbacks                      = this.defaultCallbacks(callback);
                this.validator                      = this.defaultValidator(validator);
                this.parser                         = this.defaultParser(parser);
                this.attempts                       = attempts;
                this.requestHeaders                 = this.parseRequestHeaders(this.defaultRequestHeaders(headers));
                this.requestPost                    = post;
                this.requestPostParsed              = this.parseRequestPost(post);
                this.httpRequest.onreadystatechange = this.onreadystatechange.bind(this);
                this.httpRequest.ontimeout          = this.ontimeout.bind(this);
                this.httpRequest.onerror            = this.onerror.bind(this);
                this.send();
            } else {
                throw new Error('Method should be defined as instance of class [Method]');
            }
        } else {
            throw new Error('URL should be defined as STRING.');
        }
    }
    send(){
        this.httpRequest.open(this.method.get(), this.url, true);
        this.setRequestHeaders();
        this.httpRequest.send(this.requestPostParsed);
    }
    nextAttempt(){
        if (this.attempts > 1){
            this.attempts -= 1;
            this.send();
            return true;
        } else {
            return false;
        }
    }
    ontimeout(event : Event){
        this.acceptTimeout(event);
    }
    onerror(event : Event){
        this.acceptError(event);
    }
    onreadystatechange( event : Event) {
        switch (this.httpRequest.readyState) {
            case XMLHttpRequest.HEADERS_RECEIVED:
                this.acceptHeaders();
                break;
            case XMLHttpRequest.DONE:
                if (this.httpRequest.status === 200) {
                    this.acceptSuccess();
                } else {
                    this.acceptError(event);
                    return false;
                }
                break;
        }
    }
    callback(name: string | string[], ...args: any[]){
        if (name instanceof Array){
            name.forEach((name)=>{
                this.callbacks[name].forEach((callback : Function)=>{
                    callback.apply(this, args);
                });
            });
        } else {
            this.callbacks[name].forEach((callback : Function)=>{
                callback.apply(this, args);
            });
        }
    }
    acceptHeaders() {
        let headers = this.httpRequest.getAllResponseHeaders();
        if (typeof headers === 'string'){
            headers.split('\r\n').forEach((header)=>{
                let pair = header.split(':');
                if (pair.length === 2){
                    this.responseHeaders[pair[0]] = pair[1];
                }
            });
        }
        this.callback(CALLBACKS.headers, this.responseHeaders);
    }
    acceptSuccess(){
        this.response = this.httpRequest.responseText;
        if (this.responseHeaders[RESPONSE_HEADERS.FILE] !== void 0){
            this.response = {
                code: 0,
                output: {
                    file: this.response
                }
            };
            this.callback(CALLBACKS.done, this.response);
        } else {
            try {
                this.response = JSON.parse(this.response);
            } catch (e){ }
            this.response = this.parser(this.response);
            if (this.validator(this.response)){
                this.callback(CALLBACKS.done, this.response);
            } else {
                this.acceptError(new Error('Not valid responce'));
            }
        }
    }
    acceptError(event : Event | Error){
        !this.nextAttempt() && this.callback([CALLBACKS.error, CALLBACKS.fail],  event);
    }
    acceptChange(event : Event){
        this.callback(CALLBACKS.change, event);
    }
    acceptTimeout(event : Event){
        !this.nextAttempt() && this.callback([CALLBACKS.timeout, CALLBACKS.fail],  event);
    }
    defaultValidator(validator : Function | any){
        return typeof validator === 'function' ? validator : function (){ return true; };
    }
    defaultParser(parser : Function | any){
        return typeof parser === 'function' ? parser : function (data : any){ return data; };
    }
    defaultCallbacks(callbacks : Object = {}){
        if (typeof callbacks === 'function'){
            callbacks = {
                [CALLBACKS.done] : [callbacks]
            };
        } else if (typeof callbacks !== 'object' || callbacks === null){
            callbacks = {};
        }
        Object.keys(CALLBACKS).forEach((key)=>{
            callbacks[CALLBACKS[key]] === void 0            && (callbacks[CALLBACKS[key]] = []);
            !(callbacks[CALLBACKS[key]] instanceof Array)   && (callbacks[CALLBACKS[key]] = [callbacks[CALLBACKS[key]]]);
        });
        return callbacks;
    }
    defaultRequestHeaders(headers : Object = null){
        if (typeof headers !== 'object' || headers === null){
            headers = {};
        }
        headers[HEADERS.CONTENT_TYPE]   === void 0 && (headers[HEADERS.CONTENT_TYPE]    = 'application/x-www-form-urlencoded');
        headers[HEADERS.ACCEPT]         === void 0 && (headers[HEADERS.ACCEPT]          = '*/*');
        return headers;
    }
    parseRequestHeaders(headers = {}){
        Object.keys(headers).forEach((key)=>{
            let parts = key.split('-');
            parts.forEach((part, index)=>{
                parts[index] = part.charAt(0).toUpperCase() + part.slice(1);
            });
            headers[parts.join('-')] = headers[key];
        });
        return headers;
    }
    setRequestHeaders(){
        Object.keys(this.requestHeaders).forEach((key)=>{
            if (typeof this.requestHeaders[key] === 'string'){
                this.httpRequest.setRequestHeader(key, this.requestHeaders[key]);
            } else {
                throw new Error('Value of header should be STRING. Check HEADER [' + key + ']');
            }
        });
    }
    parseRequestPost(post : any = {}){
        let params = {},
            result = '';
        if (post instanceof Array){
            post.map((param)=>{
                if (typeof param === 'string'){
                    return param.trim();
                } else {
                    throw new Error('As parameter (in array) can be used only STRING');
                }
            }).forEach((param)=>{
                let pair = param.split('=');
                if (pair.length === 2){
                    params[pair[0]] = pair[1];
                } else {
                    throw new Error('As parameter (in array) can be used only pair: key=value');
                }
            });
        } else if (typeof post === 'object' && post !== null){
            Object.keys(post).forEach((key)=>{
                switch(typeof post[key]){
                    case 'string':
                        params[key] = post[key];
                        break;
                    case 'boolean':
                        params[key] = post[key].toString();
                        break;
                    case 'number':
                        params[key] = post[key].toString();
                        break;
                    default:
                        try{
                            params[key] = JSON.stringify(post[key]);
                        } catch (e) { }
                        break;
                }
            });
        } else if (typeof post !== 'string'){
            throw new Error('Parameters of request can be: OBJECT[key = value], ARRAY[key,value] or STRING. Type of not valid parameters is: [' + typeof post + ']')
        } else {
            params = post;
        }
        if (typeof params === 'object'){
            if (/application\/json/gi.test(this.requestHeaders[HEADERS.CONTENT_TYPE])){
                result = JSON.stringify(params);
            } else {
                let encodeURI = /-urlencoded/gi.test(this.requestHeaders[HEADERS.CONTENT_TYPE]);
                Object.keys(params).forEach((key, index)=>{
                    result += (index > 0 ? '&' : '') + key + '=' + (encodeURI ? encodeURIComponent(params[key]) : params[key]);
                });
            }
        }
        if (typeof params === 'string') {
            result = params;
        }
        //Parameters are converted to string
        return result;
    }
    then(callback : Function = null){
        typeof callback === 'function' && this.callbacks[CALLBACKS.done].push(callback);
        return this;
    }
    catch(callback : Function = null){
        typeof callback === 'function' && this.callbacks[CALLBACKS.fail].push(callback);
        return this;
    }
}

export { Request, Method, DIRECTIONS, CALLBACKS}
