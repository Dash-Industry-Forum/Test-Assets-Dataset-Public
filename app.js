var express = require('express');
var compression = require('compression');
var mongoose = require('mongoose');
var swaggerMongoose = require('swagger-mongoose');
var jwt = require("express-jwt");
var pathToRegexp = require('path-to-regexp');
var cors = require('cors');

// ACL. Global variable
acl = require('acl');
var fs = require('fs');
var path = require('path');
var bodyParser = require('body-parser');
var logger = require('morgan');

var schema = fs.readFileSync('./swagger.json');

//Config
var config = require('config');

// Models. Global variable
models = swaggerMongoose.compile(JSON.parse(schema)).models;

// Initialize deep populate plugin
var deepPopulate = require('mongoose-deep-populate')(mongoose);
global.models.FeatureGroup.schema.plugin(deepPopulate);
global.models.Feature.schema.plugin(deepPopulate);
global.models.Testcase.schema.plugin(deepPopulate);
global.models.Testvector.schema.plugin(deepPopulate);

var users = require('./routes/users');
var testcases = require('./routes/testcases');
var mytestcases = require('./routes/mytestcases');
var testvectors = require('./routes/testvectors');
var mytestvectors = require('./routes/mytestvectors');
var features = require('./routes/features');
var attributes = require('./routes/attributes');
var myfeatures = require('./routes/myfeatures');
var featuregroups = require('./routes/featuregroups');
var myfeaturegroups = require('./routes/myfeaturegroups');
var myattributes = require('./routes/myattributes');
var statistics = require('./routes/statistics');
var utils = require('./routes/utils');

var app = express();

//Mongoose DEBUG output is disabled.
mongoose.set('debug', false);
mongoose.Promise = require('q').Promise;
mongoose.connect('mongodb://' + config.get('dbConfig.url') + ':' + config.get('dbConfig.port') + "/" + config.get('dbConfig.dbName'), {
    user: config.get('dbConfig.user'),
    pass: config.get('dbConfig.pass')
});
mongoose.connection.on('error', function () {
    console.log('Mongoose connection error');
});
mongoose.connection.once('open', function callback() {
    console.log("Mongoose connected to the database");
    acl = new acl(new acl.mongodbBackend(mongoose.connection.db, config.get('dbConfig.aclPrefix')));
});

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use(logger('dev'));
app.use(cors());
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static(path.join(__dirname, 'public')));

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE");
    if (req.method == 'OPTIONS') {
        res.status(200).end();
    } else {
        next();
    }
});

var path = ['/',
    '/v1/users/login',
    '/v1/testcases',
    '/v1/featuregroups',
    '/v1/statistics/size',
    '/v1/statistics/testvector/types',
    '/v1/statistics/testcase/types',
    '/v1/statistics/feature/types',
    '/v1/statistics/featuregroup/types',
    new RegExp(pathToRegexp('/v1/testcases/:id/features')),
    new RegExp(pathToRegexp('/v1/testcases/:id/testvectors')),
    new RegExp(pathToRegexp('/v1/testcases/:id/details')),
    '/v1/testvectors',
    '/v1/testvectors/groupedlist',
    new RegExp(pathToRegexp('/v1/testvectors/:id/testcases')),
    new RegExp(pathToRegexp('/v1/testvectors/:id/features')),
    new RegExp(pathToRegexp('/v1/testvectors/:id/details')),
    new RegExp(pathToRegexp('/v1/testvectors/search')),
    '/v1/features',
    '/v1/attributes',
    new RegExp(pathToRegexp('/v1/features/:id/testvectors')),
    new RegExp(pathToRegexp('/v1/features/:id/testcases')),
    new RegExp(pathToRegexp('/v1/features/:id/details')),
    new RegExp(pathToRegexp('/v1/featuregroups/:id/features')),
    new RegExp(pathToRegexp('/v1/featuregroups/:id/details'))
];
// Routes which doesn't require JWT Check
app.use(jwt(
  {
      secret: 'secretword',
      getToken: function fromHeaderOrQuerystring(req) {
          if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
              return req.headers.authorization.split(' ')[1];
          }
          return null;
      }
  }).unless({
      path: path
  }
));


// Routes which doesn't require
app.use(utils.middleware().unless({
    path: path
}));

app.use('/v1/users/', users);
app.use('/v1/testcases/', testcases);
app.use('/v1/mytestcases/', mytestcases);
app.use('/v1/testvectors/', testvectors);
app.use('/v1/mytestvectors/', mytestvectors);
app.use('/v1/features/', features);
app.use('/v1/attributes/', attributes);
app.use('/v1/myfeatures', myfeatures);
app.use('/v1/featuregroups/', featuregroups);
app.use('/v1/myfeaturegroups/', myfeaturegroups);
app.use('/v1/myattributes/', myattributes);
app.use('/v1/statistics', statistics);

// error handler for all components
app.use(function (err, req, res, next) {

    var errorType = typeof err,
      code = 500,
      message = "Internal Server Error",
      msg = {
          code: code,
          message: message
      };

    switch (err.name) {
        case "UnauthorizedError":
            code = err.status;
            message = undefined;
            break;
        case "BadRequestError":
        case "UnauthorizedAccessError":
        case "NotFoundError":
            code = err.status;
            message = err.inner;
            break;
        default:
            break;
    }

    msg.code = code;
    msg.message = message;
    msg.err = err;
    return res.status(code).json(msg);

});

module.exports = app;
