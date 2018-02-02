function isDesktop(){
    let electron = null;
    try{
        electron = require('../../electron');
    }catch (error){
        electron = null;
    }
    return electron !== null;
}

module.exports = {
    isDesktop: isDesktop
};