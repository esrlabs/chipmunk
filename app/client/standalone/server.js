var express = require('express');
var app = express();

app.set('port', 3003);

app.use(express.static('build'));

var server = app.listen(app.get('port'), function() {

});