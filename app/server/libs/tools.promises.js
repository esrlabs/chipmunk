const util = require('util');

function syncPromisesAll(promises){
    return new Promise((resolve, reject) => {
        function next(){
            current += 1;
            if (promises.length === current) {
                return resolve();
            }
            promises[current]
                .then(next)
                .catch(reject);

        }
        if (!(promises instanceof Array)) {
            return reject(
                new Error(`Expected as argument "promises" an Array<Promise>, but was gotten: ${util.inspect(promises)}`)
            );
        }

        if (promises.length === 0) {
            return resolve();
        }

        let current = 0;
        next = next.bind(this);
        next();
    });
};

module.exports = {
    syncPromisesAll: syncPromisesAll
};