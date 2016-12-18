var mongoose = require('mongoose');
var User = require('./db2');

mongoose.connect('mongodb://localhost/mpt');

// print number of users
var p = User.count().exec();
p.then(function (c) {
  console.log('count: ' + c + ' users are present in the system');

  // check if the user with email arbit@gmail.com exists or not
  console.log('test:findByEmail');
  return User.findByEmail('arbit@gmail.com');
},
function(err) { console.log('failed ' + err) },
function(err) { console.log('crash ' + err) }
).then(function (u) {
  if (u) {
    console.log('user with email arbit@gmail.com exists');
    return(Promise.resolve(u));
  } else {
    // add a user
    console.log('test:addUser');
    console.log('user with email arbit@gmail.com does not exists. creating.');
    return User.addUser({name: 'Arbit Singh', email: 'arbit@gmail.com', mobile: '9999999999', community: 'Brindavan Apartment', door_number: 'D402', password: 'test123'});
  }
},
function(err) { console.log('failed ' + err) },
function(err) { console.log('crash ' + err) }
).then( function (new_user) {
  if (new_user) {
    console.log('new user is added. password is ' + new_user.password);
  } else {
    console.log('user creation failed');
  }
  // change the password of the user
  console.log('test:changePassword');
  return new_user.changePassword('arbit123');
},
function(err) { console.log('failed ' + err) },
function(err) { console.log('crash ' + err) }
).then( function(u) {
  console.log('new password of the user is ' + u.password);
  console.log('test:loginUser:incorrect password');
  return User.loginUser('arbit@gmail.com','test123');
}).then( function(u) {
  if (!u) {
    console.log('login with wrong password failed');
    return User.loginUser('arbit@gmail.com','arbit123')
  }
  console.log('!!test failed!!');
}).then( function(u) {
  if (u) {
    console.log('user successfully logged in');
    return u.remove();
  }
},
function(err) { console.log('failed ' + err) },
function(err) { console.log('crash ' + err) }
)
.finally(function() {
  console.log('test completed');
  mongoose.disconnect();
});
