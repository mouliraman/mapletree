var crypto = require('crypto');
var mongoose = require('mongoose');

mongoose.Promise = require('bluebird');
var Schema = mongoose.Schema;

var userSchema = new Schema({
  _id: String,
    name: String,
    profile_url: String,
    email: String,
    admin: Boolean,
    mobile: String,
    community: String,
    door_number: String,
    password: String,
    reset_token: String
});

userSchema.methods.resetMe = function() {
  var token = Math.round(Math.random() * 9000000000000000);
  token += parseInt(this.id);
  this.reset_token = token.toString();
  return this.save();
};

userSchema.methods.changePassword = function(new_password) {

  var hash = crypto.createHash('sha256');
  hash.update(new_password);
  this.password = hash.digest('hex');
  return this.save();
};

userSchema.statics.findByEmail = function(email) {
  return this.findOne({email: email}).exec();
}

userSchema.statics.findByToken = function(token) {
  return this.findOne({reset_token: token}).exec();
}

userSchema.statics.loginUser = function(email, password) {

  var hash = crypto.createHash('sha256');
  hash.update(password);
  var hashed_password = hash.digest('hex');
  email = email.toLowerCase();

  return this.findOne({email: email, password: hashed_password});
};

userSchema.statics.getUniqueId = function () {

  var uid = Math.round(Math.random() * 9000000000000000);
  return User.findById(uid).exec().then(function(user) {
    if (user) {
      return User.getUniqueId();
    } else {
      return(Promise.resolve(uid));
    }
  });
};

userSchema.statics.addUser = function(user) {

  user.email = user.email.toLowerCase();
  return this.findByEmail(user.email).then(function (u) {
    if (u) {
      return(Promise.reject('email exists'));
    }

    // Hash the password
    var hash = crypto.createHash('sha256');
    hash.update(user.password);
    user.password = hash.digest('hex');

    return User.getUniqueId().then(function(_id) {
      user._id = _id;
      return User.create(user);
    });
  });
};

userSchema.statics.migrate = function() {
  var db = new require('./db')();
  // drop all the users first.
  User.count().exec().then(function(c) {
    console.log('there are ' + c + ' users in the system currently. removing all of them');
    return User.remove();
  }).then(function() {
    return User.count().exec();
  }).then(function(c) {
    console.log('there are now ' + c + ' users in the system');
    if (c) {
      throw('could not delete');
    }
    for(var i =0;i<db.data.users.length;i++) {
      db.data.users[i]._id = parseInt(db.data.users[i].id);
      delete db.data.users[i].id;
    }
    return User.insertMany(db.data.users);
  }).then(function(docs) {
    console.log('inserted ' + docs.length + ' enteries');
    console.log(docs[0]);
  });
};

var User = mongoose.model('User',userSchema);

module.exports = User;
