var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var utils = require('./utils');
var _ = require('lodash');
var Attribute = global.models.Attribute;
var FeatureGroup = global.models.FeatureGroup;
var Feature = global.models.Feature;
var Testcase = global.models.Testcase;
var Testvector = global.models.Testvector;
var User = global.models.User;
var ObjectId = mongoose.Types.ObjectId;
var Q = require('q');
var BadRequestError = require('../errors/BadRequestError');


/**
 * Restricted method
 * Get a list of attributes which belong to the user. ID is fetched from the JWT token
 */
router.get('/', function (req, res, next) {
  var id = req.user._id;
  var requestOptions;
  var username;
  var roles;

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'User ID cannot be empty.'));
  }

  requestOptions = {createdby: ObjectId(id)};
  User.findOne({_id: id}, 'username')
    .then(function (result) {
      username = result.username;
      return global.acl.userRoles(username)
    })
    .then(function (data) {
      roles = data || [];
      for (var i = 0; i < roles.length; i++) {
        if (roles[i] === 'superuser') {
          // If its a superuser he sees everything
          requestOptions = {};
        }
      }
      return Attribute.find(requestOptions);
    })
    .then(function (docs) {
      return res.status(200).json(docs);
    })
    .catch(function (err) {
      next(err);
    })
});

/**
 * Restricted method
 * Add a new attribute
 */
router.post('/', utils.checkPermissions("attributes", "create"), function (req, res, next) {

  if (_.isEmpty(req.body)) {
    return next(new BadRequestError('empty_data', 'Post data cannot be empty.'));
  }

  try {
    var attribute = new Attribute(req.body);
    var elements = [];
    var instances = [];
    var i;
    var promises = [];

    attribute.save()
      .then(function () {
        // we need to add the new attribute to the existing entries of that specific element type
        switch (attribute.type) {
          case utils.TYPES.FEATURE_GROUP:
            return FeatureGroup.find();
            break;
          case utils.TYPES.FEATURE:
            return Feature.find();
            break;
          case utils.TYPES.TESTCASE:
            return Testcase.find();
            break;
          case utils.TYPES.TESTVECTOR:
            return Testvector.find();
            break;
        }
      })
      .then(function (data) {
        // Create one attribute instance for each element
        elements = data;
        for (i = 0; i < elements.length; i++) {
          instances.push({value: attribute.defaultValue, attribute: attribute._id})
        }
        return utils.insertManyAttributeInstances(instances);
      })
      .then(function (attributeInstances) {
        for (i = 0; i < attributeInstances.length; i++) {
          // save the new attribute instance in each element
          elements[i].attributeInstances.push(attributeInstances[i]._id);
          promises.push(elements[i].save());
        }
        return Q.all(promises);
      })
      .then(utils.writeFeatureTestVectorJSON())
      .then(function () {
        return res.status(200).json(attribute);
      })
      .catch(function (error) {
        return next(new BadRequestError('validation', 'Validation Error'));
      })

  } catch (e) {
    return next(new BadRequestError('validation', 'Validation Error'));
  }
});

module.exports = router;