const APICommandInterface = {
    GUID    : {
        type        : ['string'],
        canBeEmpty  : false,
        canBeNull   : false,
        canBeMissed : false,
        parser      : false
    },
    command : {
        type        : ['string'],
        canBeEmpty  : false,
        canBeNull   : false,
        canBeMissed : false,
        parser      : false
    },
    params  : {
        type        : ['object'],
        canBeEmpty  : true,
        canBeNull   : true,
        canBeMissed : true,
        parser      : JSON.parse
    }
};

module.exports = APICommandInterface;
