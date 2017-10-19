var express = require('express');
var router = express.Router();
var utils = require('./utils');
var Attribute = global.models.Attribute;
var _ = require('lodash');
var Q = require('q');
var BadRequestError = require('../errors/BadRequestError');
var AttributeInstance = global.models.AttributeInstance;
var FeatureGroup = global.models.FeatureGroup;
var Feature = global.models.Feature;
var Testcase = global.models.Testcase;
var Testvector = global.models.Testvector;


global.models.Attribute.schema.pre('save', function (next) {
  var now = new Date();
  if (!this.createdAt) {
    this.createdAt = now;
  }
  next();
});

/**
 * Public call
 * GET a list of all attributes
 * @params {string} [type] - The type of the attribute e.g feature
 */
router.get('/', function (req, res, next) {
  var constraints = {};

  if (req.query.type) {
    constraints.type = req.query.type;
  }
  try {
    Attribute
      .find(constraints, function (err, result) {
        if (err) {
          next(err);
        }
        return res.status(200).json(result);
      });
  }
  catch (e) {
    return next(e);
  }
});

/**
 * Restricted call
 * GET an attribute by id
 * @param {string} id
 */
router.get('/:id', utils.checkPermissions("attributes", "read"), function (req, res, next) {
  var id = req.params.id;

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'Attribute ID cannot be empty.'));
  }

  try {
    Attribute
      .findOne({_id: id})
      .exec(function (err, result) {
        if (err) {
          next(err);
        }
        return res.status(200).json(result);
      });
  }
  catch (e) {
    return next(e);
  }
});

/**
 * Restricted call
 * Update an attribute by id
 * @param {string} id
 */
router.put('/:id', utils.checkPermissions("attributes", "update"), function (req, res, next) {
  var id = req.params.id;
  var now = new Date();

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'Attribute ID cannot be empty.'));
  }
  try {
    req.body.updatedAt = now;
    delete req.body.id;
    Attribute.update({_id: id}, req.body, function (err, result) {
      if (err) console.log(err);

      Attribute
        .findOne({_id: id})
        .exec(function (err, result) {
          if (err) {
            next(err);
          }

          // update dashjs.json
          utils.writeFeatureTestVectorJSON()

          return res.status(200).json(result);
        });
    });
  }
  catch (e) {
    return next(e);
  }

});

/**
 * Restricted call
 * Delete an attribute by id
 * @param {string} id
 */
router.delete('/:id', utils.checkPermissions("attributes", "delete"), function (req, res, next) {
  var id = req.params.id;
  var promises = [];
  var attribute;
  var attributeInstanceIds = [];

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'Attribute ID cannot be empty.'));
  }
  try {
    // Delete all the attribute instances of that attribute and the refs to that instances
    // 1. Find the attribute and get the type
    Attribute.findById(id)
      .then(function (data) {
        attribute = data;
        // 2. Find the attribute instances of that type
        return AttributeInstance.find({attribute: {$in: [id]}})
      })
      .then(function (attributeInstances) {
        // Find all the elements which have the attribute type and the references to that instances
        attributeInstances.forEach(function (item) {
          attributeInstanceIds.push(item._id);
        });
        switch (attribute.type) {
          case utils.TYPES.FEATURE_GROUP:
            return FeatureGroup.find({attributeInstances: {$in: attributeInstanceIds}});
            break;
          case utils.TYPES.FEATURE:
            return Feature.find({attributeInstances: {$in: attributeInstanceIds}});
            break;
          case utils.TYPES.TESTCASE:
            return Testcase.find({attributeInstances: {$in: attributeInstanceIds}});
            break;
          case utils.TYPES.TESTVECTOR:
            return Testvector.find({attributeInstances: {$in: attributeInstanceIds}});
            break;
        }
      })
      .then(function (result) {
        // Pull out the target ids from the results
        result.forEach(function (item) {
          promises.push(item.update({$pullAll: {attributeInstances: attributeInstanceIds}}));

        });
        return Q.all(promises);
      })
      .then(function () {
        // Now delete the attribute and attribute Instances
        promises = [];
        promises.push(AttributeInstance.remove({attribute: {$in: [id]}}));
        promises.push(Attribute.findByIdAndRemove(id));
        return Q.all(promises);
      })
      .then(utils.writeFeatureTestVectorJSON())
      .then(function (result) {
        return res.status(200).json(result);
      })
      .catch(function (error) {
        return next(new BadRequestError('validation', 'Validation Error'));
      });
  }
  catch (e) {
    return next(e);
  }

});

module.exports = router;