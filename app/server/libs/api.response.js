class Response {

    constructor(){
        this.code   = 0;
        this.output = '';
    }

}

ResponseSender = function (out, response) {
    response.writeHead(200, {'Content-Type': 'text/plain'});
    response.end(JSON.stringify(out));
};

module.exports = {
    Response        : Response,
    ResponseSender  : ResponseSender
};
