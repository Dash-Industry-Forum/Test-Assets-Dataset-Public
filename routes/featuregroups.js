var express = require('express');
var router = express.Router();
var utils = require('./utils');
var FeatureGroup = global.models.FeatureGroup;
var Feature = global.models.Feature;
var Testcase = global.models.Testcase;
var Testvector = global.models.Testvector;
var Q = require('q');
var _ = require('lodash');
var BadRequestError = require('../errors/BadRequestError');

global.models.FeatureGroup.schema.pre('save', function (next) {
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
  FeatureGroup.find().deepPopulate('attributeInstances attributeInstances.attribute')
    .then(function (docs) {
      return res.status(200).json(docs);
    })
    .catch(function (err) {
      next(err);
    })
});

/**
 * Public method
 * GET details of a feature group by id.
 * @param {string} id
 */
router.get('/:id/details', function (req, res, next) {
  var id = req.params.id;
  var response = {};
  var targetIds = [];
  var promises = [];

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'Feature Group ID cannot be empty.'));
  }

  promises.push(FeatureGroup.findById(id).deepPopulate('attributeInstances attributeInstances.attribute'));
  promises.push(Feature.find({featureGroup: {$in: [id]}}).deepPopulate('featureGroup'));
  Q.all(promises)
    .then(function (docs) {
      response.featureGroup = docs[0];
      response.features = docs[1];
      docs[1].forEach(function (item) {
        targetIds.push(item._id);
      });
      return Testcase.find({feature: {$in: targetIds}}).deepPopulate('feature feature.featureGroup');
    })
    .then(function (docs) {
      targetIds = [];
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
 * Public method
 * GET all features of a feature group including the attributes
 * @param {string} id
 */
router.get('/:id/features', function (req, res, next) {
  var id = req.params.id;

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'Feature Group ID cannot be empty.'));
  }
  Feature.find({featureGroup: {$in: [id]}}).deepPopulate('attributeInstances attributeInstances.attribute')
    .then(function (docs) {
      return res.status(200).json(docs);
    })
    .catch(function (err) {
      next(err);
    })
});

/**
 * Restricted call
 * GET a feature group by id.
 * @param {string} id
 */
router.get('/:id', utils.checkPermissions("featuregroups", "read"), function (req, res, next) {
  var id = req.params.id;

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'Feature Group ID cannot be empty.'));
  }

  FeatureGroup.findById(id).deepPopulate('attributeInstances attributeInstances.attribute')
    .then(function (docs) {
      return res.status(200).json(docs);
    })
    .catch(function (err) {
      next(err);
    })
});


/**
 * Restricted call
 * Update a feature group by id.
 * Expects the payload of the attribute instances to be in the form [{._id,value},{._id,value}]
 * @param {string} id
 */
router.put('/:id', utils.checkPermissions("featuregroups", "update"), function (req, res, next) {
  var id = req.params.id;
  var data;
  var now = new Date();

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'Feature Group ID cannot be empty.'));
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
      return FeatureGroup.findOneAndUpdate({_id: id}, {
        "$set": {
          "name": data.name,
          "active": data.active,
          "includeInDashjsJson": data.includeInDashjsJson,
          "updatedAt": data.updatedAt,
        }
      }, {new: true}).deepPopulate('attributeInstances attributeInstances.attribute')
    })
    .then(function (result) {
      utils.writeFeatureTestVectorJSON();
      return res.status(200).json(result);
    })
    .catch(function (err) {
      next(err)
    })
})
;

/**
 * Restricted call
 * Delete a feature group by id
 * @param {string} id
 */
router.delete('/:id', utils.checkPermissions("featuregroups", "delete"), function (req, res, next) {
  var id = req.params.id;
  var attributeInstancesIds;

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'Feature Group ID cannot be empty.'));
  }

  // Delete all attributes of the element, afterwards delete the element
  FeatureGroup.findOne({_id: id})
    .then(function (doc) {
      attributeInstancesIds = doc.attributeInstances || [];
      return utils.deleteManyAttributeInstances(attributeInstancesIds)
    })
    .then(function () {
      return FeatureGroup.findByIdAndRemove({_id: id})
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