/**
 * Created by danielsilhavy on 17.06.16.
 */

var utils = require('./utils');

var role = 'superuser';
var username = 'user';
var password = 'user';


utils.conntectToDatabase()
  .then(function () {
      return utils.addUserRoles();
  })
  .then(function () {
      return utils.createUser(username, password, role);
  })
  .then(function () {
      console.log("Created Testuser and roles");
      return 1;
  })
  .catch(function (error) {
      console.log(error)
  });


