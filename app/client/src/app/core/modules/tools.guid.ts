class GUIDGenerator{
    S4(){
        return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    }
    generate(){
        return (this.S4() + this.S4() + "-" + this.S4() + "-4" + this.S4().substr(0,3) + "-" + this.S4() + "-" + this.S4() + this.S4() + this.S4()).toLowerCase();
    }
}

let GUID = new GUIDGenerator();

export { GUID };