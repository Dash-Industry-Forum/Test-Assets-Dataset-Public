var Q = require('q');
var bcrypt = require('bcryptjs');
var _ = require("lodash");
var jsonwebtoken = require("jsonwebtoken");
var TOKEN_EXPIRATION = 180;
var TOKEN_EXPIRATION_SEC = TOKEN_EXPIRATION * 60;
var UnauthorizedAccessError = require('../errors/UnauthorizedAccessError');
var User = global.models.User;
var AttributeInstance = global.models.AttributeInstance;

var DASHJS_HTTP_URL = 'http://reference.dashif.org/dash.js/latest/samples/dash-if-reference-player/index.html';
var DASHJS_HTTPS_URL = 'https://reference.dashif.org/dash.js/latest/samples/dash-if-reference-player/index.html';

module.exports.TYPES = {
  FEATURE_GROUP: 'Feature Group',
  FEATURE: 'Feature',
  TESTCASE: 'Testcase',
  TESTVECTOR: 'Testvector'
};

module.exports.fetch = function (headers) {
  if (headers && headers.authorization) {
    var authorization = headers.authorization;
    var part = authorization.split(' ');
    if (part.length === 2) {
      var token = part[1];
      return part[1];
    } else {
      return null;
    }
  } else {
    return null;
  }
};

module.exports.isAdmin = function (id) {
  var q = Q.defer();
  var isAdmin = false;
  var username;
  var roles;

  if (_.isEmpty(id)) {
    q.resolve(isAdmin);
  }
  else {
    User.findOne({_id: id}, 'username')
      .then(function (result) {
        username = result.username;
        return global.acl.userRoles(username)
      })
      .then(function (data) {
        roles = data || [];
        for (var i = 0; i < roles.length; i++) {
          if (roles[i] === 'superuser' || roles[i] === 'admin') {
            isAdmin = true;
          }
        }
        q.resolve(isAdmin);
      })
      .catch(function () {
        q.resolve(isAdmin);
      })
  }
  return q.promise;
};

module.exports.create = function (user, req, res, next) {

  if (_.isEmpty(user)) {
    return next(new Error('User data cannot be empty.'));
  }

  var data = {
    _id: user._id,
    username: user.username,
    roles: user.roles,
    // Move secret key for token to configuration.
    token: jsonwebtoken.sign({
      _id: user._id,
      username: user.username,
      roles: user.roles
    }, "secretword", {expiresInMinutes: TOKEN_EXPIRATION})
  };

  var decoded = jsonwebtoken.decode(data.token);

  data.token_exp = decoded.exp;
  data.token_iat = decoded.iat;

  req.user = data;
  next();

  return data;

};

module.exports.retrieve = function (id, done) {

  if (_.isNull(id)) {
    return done(new Error("token_invalid"), {
      "message": "Invalid token"
    });
  }
  done();
};

// Requires to sepciffy "SecretKey";
//
module.exports.verify = function (req, res, next) {

  var token = exports.fetch(req.headers);

  jsonwebtoken.verify(token, "secretword", function (err, decode) {

    if (err) {
      req.user = undefined;
      return next(new UnauthorizedAccessError("invalid_token", err));
    }

    exports.retrieve(token, function (err, data) {

      if (err) {
        req.user = undefined;
        return next(new UnauthorizedAccessError("invalid_token", data));
      }

      req.user = data;
      next();

    });

  });
};

module.exports.expire = function (headers) {

  var token = exports.fetch(headers);

  if (token !== null) {
//        client.expire(token, 0);
  }

  return token !== null;

};

module.exports.middleware = function () {

  var func = function (req, res, next) {
    var token = exports.fetch(req.headers);

    exports.retrieve(token, function (err, data) {
      if (err) {
        req.user = undefined;
        return next(new UnauthorizedAccessError("invalid_token", data));
      } else {
        req.user = _.merge(req.user, data);
        next();
      }

    });
  };

  func.unless = require("express-unless");

  return func;

};

module.exports.authenticate = function (req, res, next) {

  var username = req.body.username,
    password = req.body.password;

  if (_.isEmpty(username) || _.isEmpty(password)) {
    return next(new UnauthorizedAccessError("401", {
      message: 'Invalid username or password'
    }));
  }

  process.nextTick(function () {

    User.findOne({
      username: username
    }, function (err, user) {

      if (err || !user) {
        return next(new UnauthorizedAccessError("401", {
          message: 'Invalid username or password'
        }));
      }

      exports.comparePassword(password, user.password, function (err, isMatch) {
        if (isMatch && !err) {
          global.acl.userRoles(user.username, function (err, roles) {
            if (err) next(err);
            user.roles = roles;
            exports.create(user, req, res, next);
          });
        } else {
          return next(new UnauthorizedAccessError("401", {
            message: 'Invalid username or password'
          }));
        }
      });
    });

  });
};

module.exports.checkPermissions = function (resource, action) {

  return function (req, res, next) {


    global.acl.isAllowed(req.user.username, resource, action, function (err, result) {

      if (err) {
        next(err);
      }

      if (result) {
        next();
      } else {
        return next(new UnauthorizedAccessError("401", {
          message: 'No sufficient rights'
        }))
      }
    });
  }
};

module.exports.comparePassword = function (passw, passw1, cb) {
  bcrypt.compare(passw, passw1, function (err, isMatch) {
    if (err) {
      return cb(err);
    }
    cb(null, isMatch);
  });
};

module.exports.JSONFlatten = function (data) {
  var result = {};

  function recurse(cur, prop) {
    if (Object(cur) !== cur) {
      result[prop] = cur;
    } else if (Array.isArray(cur)) {
      for (var i = 0, l = cur.length; i < l; i++)
        recurse(cur[i], prop + "[" + i + "]");
      if (l == 0)
        result[prop] = [];
    } else {
      var isEmpty = true;
      for (var p in cur) {
        isEmpty = false;
        recurse(cur[p], prop ? prop + "." + p : p);
      }
      if (isEmpty && prop)
        result[prop] = {};
    }
  }

  recurse(data, "");
  return result;
};


module.exports.updateManyAttributeInstances = function (elements) {
  var q = Q.defer();
  var requests = [];

  elements.forEach(function (item) {
    requests.push(exports.updateAttributeInstance(item));
  });
  Q.all(requests)
    .then(function (results) {
      q.resolve(results);
    })
    .catch(function (err) {
      q.reject(err);
    });

  return q.promise;
};

module.exports.updateAttributeInstance = function (element) {
  var q = Q.defer();

  AttributeInstance.update({_id: element._id}, element, function (err, result) {
    if (err) {
      q.reject(err);
    } else {
      q.resolve(result);
    }
  });

  return q.promise;
};

module.exports.insertManyAttributeInstances = function (elements) {
  var q = Q.defer();

  if (elements.length) {
    AttributeInstance.insertMany(elements, function (err, docs) {
      if (err) {
        q.reject(err);
      } else {
        q.resolve(docs);
      }
    });
  } else {
    q.resolve([]);
  }

  return q.promise;
};

module.exports.deleteManyAttributeInstances = function (ids) {
  var q = Q.defer();

  AttributeInstance.remove({_id: {$in: ids}}, function (err) {
    if (err) {
      q.reject(err);
    } else {
      q.resolve();
    }
  });

  return q.promise;
};

module.exports.processTestvector = function (item) {
  var items = [];
  var current;
  var self = this;
  var playerUrl;

  item = item.toObject();
  playerUrl = DASHJS_HTTP_URL;
  item.testcases.forEach(function (tc) {
    if (tc.active) {
      if (tc.hasOwnProperty('feature') && tc.feature.active) {
        if (tc.feature.hasOwnProperty('featureGroup') && tc.feature.featureGroup.active) {
          current = {};
          current.testvector = '<a href="#testvector/details/' + item._id + '">' + item.name + '</a>';
          current.url = '<a href=' + item.url + '>Link</a>';
          current.active = item.active;
          current.createdAt = self.formatDate(item.createdAt);
          current.updatedAt = self.formatDate(item.updatedAt);
          item.attributeInstances.forEach(function (attrInst) {
              current[attrInst.attribute.uiName] = attrInst.value;
          });
          current.testcase = tc.name;
          current.feature = tc.feature.name;
          current.featureGroup = tc.feature.featureGroup.name;
          if (isHttpsUrl(item.url)) {
            playerUrl = DASHJS_HTTPS_URL;
          }
          current.play = '<a target="blank" href="' + playerUrl + '?mpd=' + item.url + '">Play</a>';
          items.push(current)
        }
      }
    }
  });

  return items;
};

module.exports.processGroupedTestvector = function (item) {
  var self = this;
  var current = {testcases: [], features: [], featureGroups: []};
  var currentFeatures = {};
  var currentFeatureGroups = {};
  var playerUrl;

  item = item.toObject();
  playerUrl = DASHJS_HTTP_URL;
  current.testvector = '<a href="#testvector/details/' + item._id + '">' + item.name + '</a>';
  current.url = '<a href=' + item.url + '>Link</a>';
  item.attributeInstances.forEach(function (attrInst) {
      current[attrInst.attribute.uiName] = attrInst.value;
  });
  current.active = item.active;
  current.createdAt = self.formatDate(item.createdAt);
  current.updatedAt = self.formatDate(item.updatedAt);
  item.testcases.forEach(function (tc) {
    if (tc.active) {
      if (tc.hasOwnProperty('feature') && tc.feature.active) {
        if (tc.feature.hasOwnProperty('featureGroup') && tc.feature.featureGroup.active) {
          current.testcases.push(tc.name);
          if (!currentFeatures[tc.feature._id]) {
            currentFeatures[tc.feature._id] = true;
            current.features.push(tc.feature.name);
          }
          if (!currentFeatureGroups[tc.feature.featureGroup._id]) {
            currentFeatureGroups[tc.feature.featureGroup._id] = true;
            current.featureGroups.push(tc.feature.featureGroup.name);
          }
        }
      }
    }
  });
  if (isHttpsUrl(item.url)) {
    playerUrl = DASHJS_HTTPS_URL;
  }
  current.play = '<a target="blank" href="' + playerUrl + '?mpd=' + item.url + '">Play</a>';
  if (current.testcases.length > 0) {
    return current;
  } else {
    return null;
  }

};

module.exports.formatDate = function (date) {
  if (!date) {
    return '';
  }
  date = new Date(date);
  return date.getMonth() + 1 + '/' + date.getDate() + '/' + date.getFullYear();
};

var isHttpsUrl = function (url) {
  return url.indexOf('https') !== -1
};

/**
 * Query all each Feature by ID, query the corresponoding testcase and then the associated testvectors
 * to build up the dashjs.json for the reference dashjs player
 *
 * filter and remove all negative featureGroups and entities with the prop [active = false]
 *
 * @param {*} featureDocs - List of feature Documents [list of MongoDB docs]
 */
var buildDashjsJSON = function (featureDocs) {
  var q = Q.defer();
  var promises = [];

  // filter all features with includeDashjsJson set to false
  featureDocs = featureDocs.filter((function (item) {
    return item.includeInDashjsJson && item.featureGroup.includeInDashjsJson && item.name && item.name !== ' '
  }));

  featureDocs.forEach(function (item) {
    promises.push(processSingleFeature(item));
  });

  Q.all(promises)
    .then((function (featureList) {
      featureList = featureList.filter(function (item) {
        return item.submenu && item.submenu.length
      });
      q.resolve(featureList);
    }))
    .catch(function (error) {
      q.reject(error);
    });

  return q.promise;
};

var processSingleFeature = function (item) {
  var id = item._id;
  var targetIds = [];
  var q = Q.defer();
  var Testcase = global.models.Testcase;
  var Testvector = global.models.Testvector;
  var feature = {
    name: item.name,
    submenu: []
  };
  Testcase.find({
    feature: {$in: [id]},
    active: true,
    includeInDashjsJson: true
  }).deepPopulate("feature feature.featureGroup")
    .then(function (tcDocs) {
      // Get all Testvectors foreignkey of feature id
      tcDocs.forEach(function (tcItem) {
        targetIds.push(tcItem._id);
      });
      return Testvector.find({testcases: {$in: targetIds}, active: true, includeInDashjsJson: true})
        .deepPopulate("testcases testcases.feature testcases.feature.featureGroup");
    })
    .then(function (tvDocs) {
      // Build the current feature json with submenu (all testvector information)
      tvDocs.forEach(function (tvItem) {
        if (tvItem.url && tvItem.name && tvItem !== ' ') {
          feature.submenu.push({
            url: tvItem.url || '',
            name: tvItem.name || '',
            moreInfo: tvItem.description || ''
          });
        }
      });
      q.resolve(feature);
    })
    .catch(function (err) {
      console.log(err);
      q.reject();
    });
  return q.promise;
};

/**
 * function to update / create a dashjs.json file which contains a list
 * of alle features and the corresponding testvectors for the dash reference player
 */
module.exports.writeFeatureTestVectorJSON = function () {
  var q = Q.defer();

  var Feature = global.models.Feature;
  var dashJSON = {};

  Feature.find()
    .deepPopulate(
      "featureGroup attributeInstances featureGroup.attributeInstances attributeInstances.attribute featureGroup.attributeInstances.attribute"
    )
    .then(function (featureDocs) {
      // gather feature, testcase and testvector data and build up the dashJSON
      return buildDashjsJSON(featureDocs)
    })
    .then(function (featureList) {
      // write all feature testvectors in dashjs.json to public director
      var fs = require("fs");

      dashJSON['items'] = featureList;

      fs.writeFile("./public/dashjs.json", JSON.stringify(dashJSON), function (err) {
        if (err) {
          console.log(err);
          q.reject(err);
        }
        console.log("\n[Utils] Wrote new dashjs.json file to static public folder successfully!\n");
        q.resolve();
      });
    })
    .catch(function (err) {
      console.log('\n[Utils] ERROR >> :', err);
      q.reject(err);
    });
  return q.promise;
};

module.exports.TOKEN_EXPIRATION = TOKEN_EXPIRATION;
module.exports.TOKEN_EXPIRATION_SEC = TOKEN_EXPIRATION_SEC;