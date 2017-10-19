var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var utils = require('./utils');
var Feature = global.models.Feature;
var Testcase = global.models.Testcase;
var Testvector = global.models.Testvector;
var _ = require('lodash');
var BadRequestError = require('../errors/BadRequestError');

global.models.Feature.schema.pre('save', function (next) {
  var now = new Date();
  if (!this.createdAt) {
    this.createdAt = now;
  }
  next();
});

/**
 * Public method
 * GET all feature groups with all attributes, public method
 */
router.get('/', function (req, res, next) {
  Feature.find().deepPopulate('featureGroup attributeInstances featureGroup.attributeInstances attributeInstances.attribute featureGroup.attributeInstances.attribute')
    .then(function (docs) {
      return res.status(200).json(docs);
    })
    .catch(function (err) {
      next(err);
    })
});

/**
 * Public method
 * GET details of a feature by id.
 * @param {string} id
 */
router.get('/:id/details', function (req, res, next) {
  var id = req.params.id;
  var response = {};
  var targetIds = [];

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'Feature Group ID cannot be empty.'));
  }

  Feature.findById(id).deepPopulate('attributeInstances attributeInstances.attribute featureGroup')
    .then(function (docs) {
      response.feature = docs;
      return Testcase.find({feature: {$in: [id]}}).deepPopulate('feature feature.featureGroup');
    })
    .then(function (docs) {
      response.testcases = docs;
      docs.forEach(function (item) {
        targetIds.push(item._id);
      });
      return Testvector.find({testcases: {$in: targetIds}}).deepPopulate('testcases testcases.feature testcases.feature.featureGroup');
    })
    .then(function (docs) {
      response.testvectors = docs;
      return res.status(200).json(response);
    })
    .catch(function (err) {
      next(err);
    })
});

/**
 * Restricted call
 * GET a feature by id.
 * @param {string} id
 */
router.get('/:id', utils.checkPermissions("features", "read"), function (req, res, next) {
  var id = req.params.id;

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'Feature ID cannot be empty.'));
  }

  Feature.findById(id).deepPopulate('featureGroup attributeInstances featureGroup.attributeInstances attributeInstances.attribute featureGroup.attributeInstances.attribute')
    .then(function (docs) {
      return res.status(200).json(docs);
    })
    .catch(function (err) {
      next(err);
    })
});

/**
 * Public Method
 * @param {string} id - ID of the feature
 * GET all testcases which have the desired feature id
 */
router.get('/:id/testcases', function (req, res, next) {
  var id = req.params.id;

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'Feature ID cannot be empty.'));
  }
  try {
    Testcase.find({feature: {$in: [id]}}).deepPopulate('attributeInstances attributeInstances.attribute')
      .then(function (docs) {
        return res.status(200).json(docs);
      })
      .catch(function (err) {
        next(err);
      })
  }
  catch (err) {
    next(err)
  }
});

/**
 * Public method
 * @param {string} id - ID of the feature
 * GET all testvectors which have the desired feature id
 */
router.get('/:id/testvectors', function (req, res, next) {
  var id = req.params.id;
  var ids = {};
  var objectIds = [];

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'Feature ID cannot be empty.'));
  }

  Testcase.find({feature: {$in: [id]}})
    .then(function (docs) {
      docs ? docs = docs : docs = [];
      docs.forEach(function (item) {
        if (!ids[item]) {
          ids[item] = true;
          objectIds.push(item);
        }
      });
      return Testvector.find({testcases: {$in: objectIds}}).deepPopulate('attributeInstances attributeInstances.attribute')
    })
    .then(function (docs) {
      return res.status(200).json(docs);
    })
    .catch(function (err) {
      next(err);
    })
});

/**
 * Restricted call
 * Update a feature by id.
 * Expects the payload of the attribute instances to be in the form [{._id,value},{._id,value}]
 * @param {string} id
 */
router.put('/:id', utils.checkPermissions("features", "update"), function (req, res, next) {
  var id = req.params.id;
  var data;
  var now = new Date();

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'Feature ID cannot be empty.'));
  }
  // Update the attributeInstances first
  data = req.body;
  if (!data || !data.attributeInstances) {
    data.attributeInstances = [];
  }
  data.updatedAt = now;
  utils.updateManyAttributeInstances(data.attributeInstances)
    .then(function (result) {
      // update and return the element
      return Feature.findOneAndUpdate({_id: id}, {
        "$set": {
          "name": data.name,
          "active": data.active,
          "featureGroup": data.featureGroup,
          "includeInDashjsJson": data.includeInDashjsJson,
          "updatedAt": data.updatedAt
        }
      }, {new: true}).deepPopulate('attributeInstances featureGroup attributeInstances.attribute')
    })
    .then(function (result) {
      utils.writeFeatureTestVectorJSON();
      return res.status(200).json(result);
    })
    .catch(function (err) {
      next(err)
    })
});

/**
 * Restricted call
 * Delete a feature by id
 * @param {string} id
 */
router.delete('/:id', utils.checkPermissions("features", "delete"), function (req, res, next) {
  var id = req.params.id;
  var attributeInstancesIds;

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'Feature Group ID cannot be empty.'));
  }
  // Delete all attributes of the element, afterwards delete the element
  Feature.findById(id)
    .then(function (doc) {
      attributeInstancesIds = doc.attributeInstances || [];
      return utils.deleteManyAttributeInstances(attributeInstancesIds)
    })
    .then(function () {
      return Feature.findByIdAndRemove({_id: id})
    })
    .then(function (result) {
      utils.writeFeatureTestVectorJSON();
      res.status(200).json(result)
    })
    .catch(function (err) {
      next(err)
    })
});

module.exports = router;