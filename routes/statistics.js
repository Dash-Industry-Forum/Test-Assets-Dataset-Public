/**
 * Created by danielsilhavy on 05.09.16.
 */
var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var utils = require('./utils');
var Q = require('q');
var BadRequestError = require('../errors/BadRequestError');
var Attribute = global.models.Attribute;
var AttributeInstance = global.models.AttributeInstance;
var FeatureGroup = global.models.FeatureGroup;
var Feature = global.models.Feature;
var Testcase = global.models.Testcase;
var Testvector = global.models.Testvector;

/**
 * Public call
 * GET a list of all attributes
 * @params {string} [type] - The type of the attribute e.g feature
 */
router.get('/size', function (req, res, next) {
  var result = {};
  var promises = [];

  promises.push(Attribute.count({active: true}));
  promises.push(FeatureGroup.count({active: true}));
  promises.push(Feature.count({active: true}));
  promises.push(Testcase.count({active: true}));
  promises.push(Testvector.count({active: true}));
  Q.all(promises)
    .then(function (docs) {
      result.attributes = docs[0];
      result.featureGroups = docs[1];
      result.features = docs[2];
      result.testcases = docs[3];
      result.testvectors = docs[4];
      return res.status(200).json(result);
    })
    .catch(function (err) {
      next(err);
    })
});

router.get('/testvector/types', function (req, res, next) {
  Testvector.find({active: true}).deepPopulate('testcases testcases.feature testcases.feature.featureGroup')
    .then(function (docs) {
      return res.status(200).json(docs);
    })
    .catch(function (err) {
      next(err);
    })
});

router.get('/testcase/types', function (req, res, next) {
  Testcase.find({active: true}).deepPopulate('feature feature.featureGroup')
    .then(function (docs) {
      return res.status(200).json(docs);
    })
    .catch(function (err) {
      next(err);
    })
});

router.get('/feature/types', function (req, res, next) {
  Feature.find({active: true}).deepPopulate('featureGroup')
    .then(function (docs) {
      return res.status(200).json(docs);
    })
    .catch(function (err) {
      next(err);
    })
});

router.get('/featuregroup/types', function (req, res, next) {
  FeatureGroup.find({active: true})
    .then(function (docs) {
      return res.status(200).json(docs);
    })
    .catch(function (err) {
      next(err);
    })
});

module.exports = router;