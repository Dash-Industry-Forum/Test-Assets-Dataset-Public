/**
 * Created by danielsilhavy on 15.08.16.
 */

process.env.NODE_CONFIG_DIR = "../config";

var fs = require('fs');
var utils = require('./utils');
var User = utils.models.User;
var Q = require('q');

var username = 'dashif-admin';
var superUser = null;
var featureGroups = [];
var features = [];
var testcases = [];
var testvectors = [];
var oldFeatures = [];
var oldTestcases = [];
var oldTestvectors = [];

var dataimporter = {};

String.prototype.capitalizeFirstLetter = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

dataimporter.startImport = function () {
    // We clear the database before we do anything
    utils.conntectToDatabase()
      .then(function () {
          return utils.clearDatabase();
      })
      .then(function () {
          console.log("Cleared Database");
          return dataimporter.setSuperUser();
      })
      .then(function () {
          console.log("Set superuser");
          return dataimporter.importTables();
      })
      .then(function () {
          console.log("Imported Tables");
          return dataimporter.importFeatureGroups();
      })
      .then(function () {
          console.log("Imported Feature Groups");
          return dataimporter.importFeatures();
      })
      .then(function () {
          console.log("Imported Features");
          return dataimporter.importTestcases();
      })
      .then(function () {
          console.log("Imported Testcases");
          return dataimporter.importTestvectors();
      })
      .then(function () {
          console.log("Imported Testvectors")
          dataimporter.removeOldIdField();
          return;
      })
      .catch(function (err) {
          console.log(err);
      })
};

dataimporter.importTables = function () {
    var q = Q.defer();
    var fid;
    var tcid;

    fs.readFile('./data/feature.json', function (err, data) {
        if (err) {
            q.reject();
        }
        oldFeatures = JSON.parse(data);
        fs.readFile('./data/testcase.json', function (err, data) {
            if (err) {
                q.reject();
            }
            oldTestcases = JSON.parse(data);
            // fill the features field with name instead of ids
            oldTestcases.forEach(function (item) {
                fid = item.features['$oid'];
                oldFeatures.forEach(function (f) {
                    if (f._id['$oid'] === fid) {
                        item.feature = f;
                    }
                })
            })
            fs.readFile('./data/testvector.json', function (err, data) {
                if (err) {
                    q.reject();
                }
                oldTestvectors = JSON.parse(data);
                // fill the features field with name instead of ids
                oldTestvectors.forEach(function (item) {
                    item.savedTestcases = [];
                    if (item.testcases instanceof Array) {
                        item.testcases.forEach(function (tc) {
                            tcid = tc['$oid'];
                            oldTestcases.forEach(function (t) {
                                if (t._id['$oid'] === tcid) {
                                    item.savedTestcases.push(t);
                                }
                            })
                        })
                    } else {
                        tcid = item.testcases; //somehow the data structure is broken at the end
                        oldTestcases.forEach(function (t) {
                            if (t._id['$oid'] === tcid) {
                                item.savedTestcases.push(t);
                            }
                        })
                    }
                })
                q.resolve();
            });
        });

    });

    return q.promise;
};

dataimporter.importFeatureGroups = function () {
    var q = Q.defer();
    var groups = [];
    var featureGroupNames = {};
    var now = new Date();

    oldFeatures.forEach(function (item) {
        if (!featureGroupNames[item.group]) {
            featureGroupNames[item.group] = item.group;
            groups.push({
                name: item.group,
                active: true,
                createdby: superUser._id,
                createdAt : now,
                updatedAt : now,
                attributeInstances: []
            })
        }
    });
    dataimporter.createFeatureGroupEntries(groups)
      .then(function (data) {
          featureGroups = data;
          q.resolve();
      })
      .catch(function (err) {
          q.reject(err);
      })
};

dataimporter.importFeatures = function () {
    var q = Q.defer();
    var ignoredAttributes = {'_id': true, 'group': true, 'name': true, 'createdby': true};

    dataimporter.createAttributesForModel(oldFeatures, ignoredAttributes, 'Feature')
      .then(function (attributes) {
          return dataimporter.createFeatureInstances(attributes)
      })
      .then(function () {
          q.resolve();
      })
      .catch(function (err) {
          q.reject(err);
      });

    return q.promise;
};

dataimporter.importTestcases = function () {
    var q = Q.defer();
    var ignoredAttributes = {'_id': true, 'feature': true, 'features': true, 'name': true, 'createdby': true};

    dataimporter.createAttributesForModel(oldTestcases, ignoredAttributes, 'Testcase')
      .then(function (attributes) {
          return dataimporter.createTestcaseInstances(attributes)
      })
      .then(function () {
          q.resolve();
      })
      .catch(function (err) {
          q.reject(err);
      })

    return q.promise;
};

dataimporter.importTestvectors = function () {
    var q = Q.defer();
    var ignoredAttributes = {
        '_id': true,
        'url': true,
        'testcases': true,
        'savedTestcases': true,
        'name': true,
        'createdby': true,
        '__v': true
    };

    dataimporter.createAttributesForModel(oldTestvectors, ignoredAttributes, 'Testvector')
      .then(function (attributes) {
          return dataimporter.createTestvectorInstances(attributes)
      })
      .then(function () {
          q.resolve();
      })
      .catch(function (err) {
          q.reject(err);
      })

    return q.promise;
};

dataimporter.createFeatureInstances = function (attributes) {
    var q = Q.defer();
    var feature;
    var promises = [];
    var now = new Date();
    var i = 0;

    oldFeatures.forEach(function (item) {
        i = 0;
        feature = {};
        feature.name = item.name;
        feature.createdby = superUser._id;
        feature.active = true;
        feature.createdAt = now;
        feature.updatedAt = now;
        feature.attributeInstances = [];
        attributes.forEach(function (attr) {
            if (attr.type === 'Feature') {
                //create an attribute instance for each attribute
                feature.attributeInstances.push({
                    value: item[attr.description],
                    attribute: attr._id
                })
            }
        })
        // Insert with the right feature group
        if (item.group) {
            while (i < featureGroups.length) {
                if (item.group === featureGroups[i].name) {
                    feature.featureGroup = featureGroups[i]._id;
                    break;
                }
                i++;
            }
        }
        promises.push(dataimporter.createSingleInstance(feature));
    });
    Q.all(promises)
      .then(function (instances) {
          return dataimporter.createFeatureEntries(instances)
      })
      .then(function (data) {
          features = data;
          q.resolve();
      })
      .catch(function (err) {
          q.reject(err);
      });


    return q.promise;
};

dataimporter.createTestcaseInstances = function (attributes) {
    var q = Q.defer();
    var testcase;
    var promises = [];
    var now = new Date();
    var i = 0;

    oldTestcases.forEach(function (item) {
        i = 0;
        testcase = {};
        testcase.name = item.name;
        testcase.createdby = superUser._id;
        testcase.active = true;
        testcase.createdAt = now;
        testcase.updatedAt = now;
        testcase.oldId = item._id['$oid']; // This is ugly but the fastest way to not lose the references when we create the testvectors. We have to delete that attribute in the end
        testcase.attributeInstances = [];
        attributes.forEach(function (attr) {
            if (attr.type === 'Testcase') {
                //create an attribute instance for each attribute
                testcase.attributeInstances.push({
                    value: item[attr.description],
                    attribute: attr._id
                })
            }
        })
        // Insert with the right feature
        if (item.feature) {
            while (i < features.length) {
                if (item.feature.name === features[i].name) {
                    testcase.feature = [features[i]._id];
                    break;
                }
                i++;
            }
        }
        promises.push(dataimporter.createSingleInstance(testcase));
    });
    Q.all(promises)
      .then(function (instances) {
          return dataimporter.createTestCaseEntries(instances)
      })
      .then(function (data) {
          testcases = data;
          q.resolve();
      })
      .catch(function (err) {
          q.reject(err);
      });


    return q.promise;
};

dataimporter.createTestvectorInstances = function (attributes) {
    var q = Q.defer();
    var testvector;
    var promises = [];
    var now = new Date();
    var i = 0;

    oldTestvectors.forEach(function (item) {
        i = 0;
        testvector = {};
        testvector.name = item.name;
        testvector.createdby = superUser._id;
        testvector.active = true;
        testvector.url = item.url;
        testvector.attributeInstances = [];
        testvector.createdAt = now;
        testvector.updatedAt = now;
        testvector.testcases = [];
        attributes.forEach(function (attr) {
            if (attr.type === 'Testvector') {
                //create an attribute instance for each attribute
                testvector.attributeInstances.push({
                    value: item[attr.description],
                    attribute: attr._id
                })
            }
        })
        // Insert with the right testcases
        item.savedTestcases.forEach(function (tc) {
            while (i < testcases.length) {
                if (tc._id['$oid'] === testcases[i].oldId) {
                    testvector.testcases.push(testcases[i]._id);
                    break;
                }
                i++;
            }
            i = 0;
        });
        promises.push(dataimporter.createSingleInstance(testvector));
    });
    Q.all(promises)
      .then(function (instances) {
          return dataimporter.createTestVectorEntries(instances)
      })
      .then(function (data) {
          testvectors = data;
          q.resolve();
      })
      .catch(function (err) {
          q.reject(err);
      });


    return q.promise;
};

dataimporter.createSingleInstance = function (instance) {
    var q = Q.defer();

    dataimporter.createAttributeInstanceEntries(instance.attributeInstances)
      .then(function (docs) {
          instance.attributeInstances = [];
          docs.forEach(function (data) {
              instance.attributeInstances.push(data._id);
          })
          q.resolve(instance)
      })
      .catch(function (err) {
          q.reject(err);
      })
    return q.promise;
};

dataimporter.createAttributesForModel = function (elements, ignoredAttributes, type) {
    var attributes = [];
    var attributeNames = {};
    var now = new Date();

    elements.forEach(function (item) {
        for (var key in item) {
            if (item.hasOwnProperty(key)) {
                if (!attributeNames[key] && !ignoredAttributes[key]) {
                    attributeNames[key] = key;
                    attributes.push({
                        description: key,
                        uiName: key,
                        active: true,
                        shownByDefault: true,
                        type: type,
                        defaultValue: '',
                        createdby: superUser._id,
                        createdAt: now,
                        updatedAt: now,
                        deletable: true
                    })
                }
            }
        }
    });
    return dataimporter.createAttributeEntries(attributes);
};

dataimporter.setSuperUser = function () {
    var q = Q.defer();

    User.findOne({'username': username})
      .then(function (data) {
          superUser = data;
          q.resolve();
      })
      .catch(function (err) {
          q.reject(err);
      });

    return q.promise;
};


dataimporter.createAttributeEntries = function (attributes) {
    var q = Q.defer();

    utils.models.Attribute.collection.insert(attributes, {}, function (err, docs) {
        err ? q.reject(err) : q.resolve(docs.ops);
    });
    return q.promise;
};

dataimporter.createFeatureGroupEntries = function (featureGroups) {
    var q = Q.defer();

    utils.models.FeatureGroup.collection.insert(featureGroups, {}, function (err, docs) {
        err ? q.reject(err) : q.resolve(docs.ops);
    });
    return q.promise;
};

dataimporter.createAttributeInstanceEntries = function (attributeInstances) {
    var q = Q.defer();

    utils.models.AttributeInstance.collection.insert(attributeInstances, {}, function (err, docs) {
        err ? q.reject(err) : q.resolve(docs.ops);
    });
    return q.promise;
};

dataimporter.createTestCaseEntries = function (testcases) {
    var q = Q.defer();

    utils.models.Testcase.collection.insert(testcases, {}, function (err, docs) {
        err ? q.reject(err) : q.resolve(docs.ops);
    });
    return q.promise;
};

dataimporter.createTestVectorEntries = function (testvectors) {
    var q = Q.defer();

    utils.models.Testvector.collection.insert(testvectors, {}, function (err, docs) {
        err ? q.reject(err) : q.resolve(docs.ops);
    });
    return q.promise;
};

dataimporter.createFeatureEntries = function (features) {
    var q = Q.defer();

    utils.models.Feature.collection.insert(features, {}, function (err, docs) {
        err ? q.reject(err) : q.resolve(docs.ops);
    });
    return q.promise;
};

dataimporter.removeOldIdField = function () {
    utils.models.Testcase.collection.update({}, {$unset: {oldId: 1}}, {multi: true});
};

dataimporter.startImport();