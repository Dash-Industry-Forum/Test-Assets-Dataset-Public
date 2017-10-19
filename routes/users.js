var express = require('express');
var router = express.Router();
var utils = require('./utils');
var bcrypt = require('bcryptjs');
var _ = require('lodash');
var Q = require('q');
var User = global.models.User;
var FeatureGroup = global.models.FeatureGroup;
var Feature = global.models.Feature
var Testcase = global.models.Testcase;
var Testvector = global.models.Testvector;
var Attribute = global.models.Attribute;


var BadRequestError = require('../errors/BadRequestError');
var InternalError = require('../errors/InternalError');

/*
 - Login user
 - Use utils.authenticate middleware to authenticate user (See Utils.js.)
 */
router.post('/login', utils.authenticate, function (req, res, next) {
  return res.status(200).json(req.user);
});

/*
 - GET Users list.
 - Protected method.
 */
router.get('/', utils.checkPermissions("users", "read"), function (req, res, next) {

  User
    .find({}, function (err, result) {
      if (err) next(err);
      return res.status(200).json(result);
    });
});

/*
 - Create new user
 - Protected method.
 -- TBD: Define additional fields for user model
 */
router.post('/', utils.checkPermissions("users", "create"), function (req, res, next) {

  var username = req.body.username;
  var firstname = req.body.firstname;
  var lastname = req.body.lastname;
  var companyname = req.body.companyname;
  var email = req.body.email;
  var password = req.body.password;
  var role = req.body.role;

  if (_.isEmpty(username) || _.isEmpty(password)) {
    return next(new BadRequestError('empty_data', {message: 'Username or password data cannot be empty.'}));
  }

  if (_.isEmpty(role))
    return next(new BadRequestError('empty_data', {message: 'Role data cannot be empty'}));

  var user = new User({
    username: username,
    firstname: firstname,
    lastname: lastname,
    companyname: companyname,
    email: email,
    password: password
  });

  try {
    User
      .findOne({username: username}, function (err, result) {
        if (result) {
          return next(new BadRequestError('invalid_data', {message: 'Username is already taken'}));
        }
        bcrypt.genSalt(10, function (err, salt) {

          if (err) next(err);

          bcrypt.hash(user.password, salt, function (err, hash) {
            if (err) next(err);

            user.password = hash;

            user.save(function (err) {
              if (err) next(err);

              // Adds user role
              global.acl.addUserRoles(user.username, role, function (err) {
                if (err) next(err);

                // update dashjs.json
                //   utils.writeFeatureTestVectorJSON()

                return res.status(200).json(user);
              });

            });
          });
        });
      })
  }
  catch (err) {
    return next(new InternalError('internal_err', err));
  }
});

/*
 - GET User details by ID.
 - Protected method.
 - Returns only username for now.
 */
router.get('/:id', utils.checkPermissions("users", "read"), function (req, res, next) {

  var id = req.params.id;

  if (_.isEmpty(id))
    return next(new BadRequestError('empty_data', 'User ID data cannot be empty.'));

  try {
    User
      .findOne({_id: req.params.id}, function (err, result) {

        global.acl.userRoles(result.username, function (err, roles) {

          if (err) next(err);
          result = result.toObject();
          result.roles = roles;
          return res.status(200).json(result);
        });
      });
  }
  catch (err) {
    return next(new InternalError('internal_err', err));
  }

});

/*
 - UPDATE User by id
 - Protected method.
 */
router.put('/:id', utils.checkPermissions("users", "update"), function (req, res, next) {

  //return next(new NotImplemented('not_impl', 'This feature is not yet implemented.'));
  var id = req.params.id;
  var password = req.body.password;
  var role = req.body.role;

  /*if (_.isEmpty(password)) {
   return next(new BadRequestError('empty_data', 'Password cannot be empty.'));
   }*/

  if (_.isEmpty(req.body)) {
    return next(new BadRequestError('empty_data', 'Post data cannot be empty.'));
  }

  if (_.isEmpty(id)) {
    return next(new BadRequestError('empty_data', 'TestVector ID cannot be empty.'));
  }

  try {
    if (!_.isEmpty(password)) {
      bcrypt.genSalt(10, function (err, salt) {

        if (err) next(err);

        bcrypt.hash(password, salt, function (err, hash) {
          if (err) next(err);
          req.body.password = hash;

        });
      });
    }

    User.update({_id: id}, req.body, function (err, result) {

      if (err) console.log(err);

      User
        .findOne({_id: req.params.id}, function (err, result) {

          var username = result.username;
          global.acl.userRoles(username, function (err, roles) {


            global.acl.removeUserRoles(username, roles, function (err, result) {
              if (err) next(err);

              acl.addUserRoles(username, role);
            });

            if (err) next(err);
            result = result.toObject();
            result.roles = role;
            return res.status(200).json(result);
          });
        });
    });
  }
  catch (err) {
    return next(new InternalError('bcrypt_err', err));
  }

});

/*
 - DELETE User details by ID.
 - Protected method.
 - Removes user record from database as well as removes roles from ACL tables.
 - ! Discusss how to proceed with test vectors, test cases and features when owner has been deleted.
 - Some of the options could be: Re-assign to admin or allow admins always access other users test cases.
 */
router.delete('/:id', utils.checkPermissions("users", "delete"), function (req, res, next) {
  var id = req.params.id;
  var username;
  var roles;

  if (_.isEmpty(id))
    return next(new BadRequestError('empty_data', {message: 'User ID data cannot be empty.'}));


  User.findOne({_id: req.params.id}, 'username')
    .then(function (result) {
      username = result.username;
      return global.acl.userRoles(username)
    })
    .then(function (data) {
      roles = data || [];
      for (var i = 0; i < roles.length; i++) {
        if (roles[i] === 'superuser') {
          throw new Error('User can not be deleted.');
        }
      }
      // Assign all the elements of the user to the superuser
      return reassignElements(id);
    })
    .then(function () {
      return global.acl.removeUserRoles(username, roles)
    })
    .then(function () {
      return User.remove({_id: id});
    })
    .then(function () {
      return res.sendStatus(200);
    })
    .catch(function (err) {
      return next(new BadRequestError('delete_user', err));
    })


});

function reassignElements(oldUserId) {
  var q = Q.defer();
  var promises = [];
  var user;

  // Take the first superuser and assign everything to him
  global.acl.roleUsers('superuser')
    .then(function (users) {
      if (!users || !users.length > 0) {
        throw new Error('Can not reassign elements');
      }
      user = users[0];
      return User.findOne({username: user})
    })
    .then(function (user) {
      promises.push(Attribute.update({createdby: {"$in": [oldUserId]}}, {createdby: user._id}, {multi: true}));
      promises.push(FeatureGroup.update({createdby: {"$in": [oldUserId]}}, {createdby: user._id}, {multi: true}));
      promises.push(Feature.update({createdby: {"$in": [oldUserId]}}, {createdby: user._id}, {multi: true}));
      promises.push(Testcase.update({createdby: {"$in": [oldUserId]}}, {createdby: user._id}, {multi: true}));
      promises.push(Testvector.update({createdby: {"$in": [oldUserId]}}, {createdby: user._id}, {multi: true}));
      return Q.all(promises);
    })
    .then(function () {
      q.resolve();
    })
    .catch(function (err) {
      q.reject(err);
    });


  return q.promise;
}


module.exports = router;