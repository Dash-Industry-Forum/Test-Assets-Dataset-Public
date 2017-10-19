var express = require('express');
var router = express.Router();
var utils = require('./utils');
var _ = require('lodash');
var Testvector = global.models.Testvector;
var BadRequestError = require('../errors/BadRequestError');

global.models.Testvector.schema.pre('save', function (next) {
  var now = new Date();
  if (!this.createdAt) {
    this.createdAt = now;
  }
  next();
});

/**
 * Public method
 * GET all testvectors with all attributes, public method
 */
router.get('/', function (req, res, next) {
  var result = {data: []};
  var items;

  try {
    Testvector.find().deepPopulate('testcases attributeInstances testcases.feature attributeInstances.attribute testcases.feature.featureGroup')
      .then(function (docs) {
        docs.forEach(function (item) {
          items = utils.processTestvector(item);
          items.forEach(function (doc) {
            result.data.push(doc);
          })
        });
        return res.status(200).json(result);
      })
      .catch(function (err) {
        next(err);
      })
  }
  catch (err) {
    next(err);
  }
});

router.get('/groupedlist', function (req, res, next) {
  var result = {data: []};
  var current = {};

  try {
    Testvector.find()
      .deepPopulate('testcases attributeInstances attributeInstances.attribute testcases.feature testcases.feature.featureGroup')
      .then(function (docs) {
        docs.forEach(function (item) {
          current = utils.processGroupedTestvector(item);
          if (current) {
            result.data.push(current);
          }
          current = {};
        });
        return res.status(200).json(result);
      })
      .catch(function (err) {
        next(err)
      })
  }
  catch (err) {
    next(err)
  }
});

/**
 * Public method
 * GET details of a feature by id.
 * @param {string} id
 */
router.get('/:id/details', function (req, res, next) {
  var id = req.params.id;
  var response = {};

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'Feature Group ID cannot be empty.'));
  }

  Testvector.findById(id).deepPopulate('attributeInstances attributeInstances.attribute testcases testcases.feature testcases.feature.featureGroup')
    .then(function (docs) {
      response.testvector = docs;
      return res.status(200).json(response);
    })
    .catch(function (err) {
      next(err);
    })
});

/**
 * Restricted call
 * GET a testvector by id.
 * @param {string} id
 */
router.get('/:id', utils.checkPermissions("testvectors", "read"), function (req, res, next) {
  var id = req.params.id;

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'Testvector ID cannot be empty.'));
  }

  Testvector.findById(id).deepPopulate('testcases attributeInstances testcases.attributeInstances attributeInstances.attribute testcases.attributeInstances.attribute')
    .then(function (docs) {
      return res.status(200).json(docs);
    })
    .catch(function (err) {
      next(err);
    })
});


/**
 * Restricted call
 * Update a testvector by id.
 * Expects the payload of the attribute instances to be in the form [{._id,value},{._id,value}]
 * @param {string} id
 */
router.put('/:id', utils.checkPermissions("testvectors", "update"), function (req, res, next) {
  var id = req.params.id;
  var data;
  var now = new Date();

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'Testcase ID cannot be empty.'));
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
      return Testvector.findOneAndUpdate({_id: id}, {
        "$set": {
          "name": data.name,
          "url": data.url,
          "active": data.active,
          "includeInDashjsJson": data.includeInDashjsJson,
          "testcases": data.testcases,
          "updatedAt": data.updatedAt
        }
      }, {new: true}).deepPopulate('attributeInstances testcases attributeInstances.attribute')
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
 * Delete a testvector by id.
 * Expects the payload of the attribute instances to be in the form [{._id,value},{._id,value}]
 * @param {string} id
 */
router.delete('/:id', utils.checkPermissions("testvectors", "delete"), function (req, res, next) {
  var id = req.params.id;
  var attributeInstancesIds;

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'Feature Group ID cannot be empty.'));
  }
  // Delete all attributes of the element, afterwards delete the element
  Testvector.findById(id)
    .then(function (doc) {
      attributeInstancesIds = doc.attributeInstances || [];
      return utils.deleteManyAttributeInstances(attributeInstancesIds)
    })
    .then(function () {
      return Testvector.findByIdAndRemove({_id: id})
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