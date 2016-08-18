var Fs = require('fs');
var storage = require('@google-cloud/storage');

function Db(cloud_storage) {
  if (cloud_storage) {
    this.gcs = storage({projectId: 'maple-tree-app', keyFilename:'./maple-gce.json'});
    this.bucket = this.gcs.bucket('maple-tree-app.appspot.com');
    this.bucket_file = this.bucket.file('database.json');
  } else {
    this.db_file = 'public/data/database.json';
  }

  this.load_fs = function(completeCallback) {
    if (Fs.existsSync(this.db_file)) {
      var buf = Fs.readFileSync(this.db_file);
      this.data = JSON.parse(buf.toString());
    }

    if (this.data == null) {
      this.data = {users: [], orders: {all: [], user: {}, community: {}}};
    }
    return completeCallback(null);
  }

  this.load_cloud = function(completeCallback) {
    var self = this;
    this.bucket_file.exists(function(err, exists) {
      if (!err) {
        if (exists) {
          self.bucket_file.download(function(err, contents) {
            if (!err) {
              self.data = JSON.parse(contents.toString());
            }
            return completeCallback(err);
          });
        } else {
          self.data = {users: [], orders: {all: [], user: {}, community: {}}};
          return completeCallback(null);
        }
      } else {
        return completeCallback(err);
      }
    });
  }

  this.save_fs = function(completeCallback) {
    Fs.writeFileSync(this.db_file,JSON.stringify(this.data));
    return completeCallback(null);
  }

  this.save_cloud = function(completeCallback) {
    this.bucket_file.save(JSON.stringify(this.data), function (err) {
      completeCallback(err);
    });
    return true;
  }

  if (cloud_storage) {
    this.load = this.load_cloud;
    this.save = this.save_cloud;
  } else {
    this.load = this.load_fs;
    this.save = this.save_fs;
  }

  this.getUser = function(id) {
    for(var i = 0; i<this.data.users.length; i++) {
      var u = this.data.users[i];
      if (u.id == id) {
        return u;
      }
    }
    return null;
  }

  this.updateUser = function(user) {
    var mandatory_keys = ['id', 'name', 'mobile', 'email', 'community'];
    for (var i=0;i<mandatory_keys.length;i++) {
      if (Object.keys(user).indexOf(mandatory_keys[i]) == -1) {
        return false;
      }
    }

    for(var i = 0; i<this.data.users.length; i++) {
      var u = this.data.users[i];
      if (u.id == user.id) {
        this.data.users[i] = user;
        return this.save();
      }
    }
    this.data.users.push(user);
    return this.save();
  }

  this.getOrdersForUser = function(uid, order_id) {
    if (this.data.orders) {
      if (this.data.orders[uid]) {
        return this.data.orders[uid][order_id] || [];
      }
    }
    return [];
  }

  this.getOrdersForCommunity = function(community, order_id) {
    var orders = [];
    if (this.data.orders == null) {
      return orders;
    }

    var uids = Object.keys(this.data.orders);
    for (var x=0;x<uids.length;x++) {
      var uid = uids[x];
      var user = this.getUser(uid);
      if (user.community != community) {
        continue;
      }

      var user_orders = this.getOrdersForUser(uid, order_id);

      for(var i =0;i<user_orders.length;i++) {
        var added = false;
        for(var j=0;j<orders.length;j++) {
          if (user_orders[i].description == orders[j].description) {
            orders.quantity += user_orders[i].quantity;
            added = true;
            break;
          }
        }
        if (!added) {
          orders.push(user_orders[i]);
        }
      }

    }

    return orders;
  }

  this.getOrdersForAll = function(order_id) {
    var orders = [];
    if (this.data.orders == null) {
      return orders;
    }

    var uids = Object.keys(this.data.orders);
    for (var x=0;x<uids.length;x++) {
      var uid = uids[x];
      var user_orders = this.getOrdersForUser(uid, order_id);

      for(var i =0;i<user_orders.length;i++) {
        var added = false;
        for(var j=0;j<orders.length;j++) {
          if (user_orders[i].description == orders[j].description) {
            orders.quantity += user_orders[i].quantity;
            added = true;
            break;
          }
        }
        if (!added) {
          orders.push(user_orders[i]);
        }
      }

    }

    return orders;
  }

  this.storeOrder = function(uid, order_id, orders) {
    if (this.data.orders == null) {
      this.data.orders = {};
    }
    if (this.data.orders[uid] == null) {
      this.data.orders[uid] = {};
    }
    this.data.orders[uid][order_id] = orders;
    return this.save();
  }

  return this;
}

module.exports = Db;
