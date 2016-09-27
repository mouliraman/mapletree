var Fs = require('fs');
var crypto = require('crypto');

function Db(cloud_storage) {
  if (cloud_storage) {
    var storage = require('@google-cloud/storage');
    this.gcs = storage({projectId: 'maple-tree-app', keyFilename:'./maple-gce.json'});
    this.bucket = this.gcs.bucket('maple-tree-app.appspot.com');
    this.bucket_file = this.bucket.file('database.json');
  } else {
    this.db_file = 'public/data/database.json';
    this.community_file = 'public/data/communities.json';
  }

  this.load_fs = function(completeCallback) {
    if (Fs.existsSync(this.db_file)) {
      var buf = Fs.readFileSync(this.db_file);
      this.data = JSON.parse(buf.toString());
    }

    if (this.data == null) {
      this.data = {users: [], orders: {all: [], user: {}, community: {}}};
    }
    this.communities = {};
    if (Fs.existsSync(this.community_file)) {
      var buf = Fs.readFileSync(this.community_file);
      var d = JSON.parse(buf.toString());
      for (var i = 0;i<d.length;i++) {
        this.communities[d[i].name] = d[i];
      }
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
    if (completeCallback) {
      return completeCallback(null);
    }
    return true;
  }

  this.save_cloud = function(completeCallback) {
    this.bucket_file.save(JSON.stringify(this.data), function (err) {
      if (completeCallback) {
        completeCallback(err);
      }
    });
    return true;
  }

  if (cloud_storage) {
    this.load = this.load_cloud;
    this.save = this.save_cloud;
  } else {
    this.load = this.load_fs;
    this.save = this.save_fs;
    this.load(() => {});
  }

  this.getUser = function(prop, value) {
    for(var i = 0; i<this.data.users.length; i++) {
      var u = this.data.users[i];
      if (u[prop] == value) {
        return u;
      }
    }
    return null;
  }
  this.getUserById = (id) => { return this.getUser('id', id);}
  this.getUserByEmail = (email) => { return this.getUser('email', email);}

  this.getInvoiceId = (order_id,uid) => {
    for(var i = 0; i<this.data.users.length; i++) {
      var u = this.data.users[i];
      if (u.id == uid) {
        var x = '' + (i + 1000001);
        return order_id.replace(/-/g,'') + x;
      }
    }
    return '000000';
  }

  this.loginUser = function(email, password) {
    var u = this.getUserByEmail(email.toLowerCase());

    if (u) {

      var hash = crypto.createHash('sha256');
      hash.update(password);
      var hashed_password = hash.digest('hex');

      if (u.password == hashed_password) {
        return u;
      }
    }
    return null;
  }

  this.addUser = function(user) {
    var u = this.getUserByEmail(user.email.toLowerCase());
    if (u) {
      return false;
    }

    // Hash the password
    var hash = crypto.createHash('sha256');
    hash.update(user.password);
    user.password = hash.digest('hex');
 
    // Generate a unique ID
    uid = Math.round(Math.random() * 9000000000000000);
    while (this.getUserById(uid)) {
      uid = Math.round(Math.random() * 9000000000000000);
    }
    user.id = uid;
    this.data.users.push(user);
    this.save();
    return user;
  }

  this.updateUser = function(user) {
    var mandatory_keys = ['id', 'name', 'mobile', 'email', 'community'];
    // downcase the email
    user.email = user.email.toLowerCase();
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

  this.getOrderListForUser = (user) => {
    var ret = [];
    if ((this.data.orders) && (this.data.orders[user.id])) {
      order_ids = Object.keys(this.data.orders[user.id]);
      for (var i=0;i<order_ids.length;i++) {
        var order = this.data.orders[user.id][order_ids[i]];
        ret.push({
          state: order.state,
          order_id: order.order_id,
          invoice_id: order.invoice_id,
          discount: order.discount,
          total_price: order.total_price,
          discount_price: order.discount_price
        });
      }
    }
    return ret;
  }

  this.getOrdersForUser = function(uid, order_id) {
    var order = {items: [], total_price: 0, discount_price: 0, invoice_id: 'xxxxx'};

    if ((this.data.orders) &&
        (this.data.orders[uid]) &&
        (this.data.orders[uid][order_id])
        ) {

      var order = this.data.orders[uid][order_id];
      if (!order.invoice_id) {
        order.invoice_id = this.getInvoiceId(order_id,uid);
        this.save();
      }
      var total_price = 0;
      for (var i = 0 ; i < order.items.length ; i++ ) {
        var item = order.items[i];
        item.price = Math.round(item.quantity * item.rate * 100)/100;
        total_price += item.price;
      }
      order.total_price = Math.round(total_price * 100)/100;
      if (!order.discount) {
        order.discount = 0;
      }
      order.discount_price = order.total_price - order.discount;
    }
    return order;
  }

  this.clone_order = (order) => {
    var new_order = {
      description: order.description,
      category: order.category,
      unit: order.unit,
      rate: order.rate,
      quantity: order.quantity,
      packed_quantity: order.packed_quantity
    };
    return new_order;
 
  }

  this.getOrderList = () => {
    var items = [];
    var comm_file = 'public/data/data.json';
    if (Fs.existsSync(comm_file)) {
      var buf = Fs.readFileSync(comm_file);
      items = JSON.parse(buf.toString());
      for(var i =0;i<items.length;i++) {
        items[i].quantity = 0;
      }
    }

    return items;
  }

  this.compactOrderList = (items) => {
    var new_items = [];
    for (var i=0;i<items.length;i++) {
      if (items[i].quantity > 0) {
        new_items.push(items[i]);
      }
    }
    return new_items;
  }

  this.getOrdersForCommunity = function(community, order_id) {
    if (this.data.orders == null) {
      return [];
    }

    var items = this.getOrderList();
    var users = [];

    var uids = Object.keys(this.data.orders);
    for (var x=0;x<uids.length;x++) {
      var uid = uids[x];
      var user = this.getUserById(uid);
      if (user.community != community) {
        continue;
      }

      var user_orders = this.getOrdersForUser(uid, order_id);
      if (user_orders.items.length == 0) {
        continue;
      }

      var u = this.getUserById(uid);
      var uu = {name: u.name, email: u.email, mobile: u.mobile, uid: u.id};
      uu.total_price = user_orders.total_price;
      users.push(uu);

      for(var i =0;i<user_orders.items.length;i++) {
        var added = false;
        var user_order = user_orders.items[i];
        for(var j=0;j<items.length;j++) {
          if (user_order.description == items[j].description) {
            items[j].quantity += user_order.quantity;
            added = true;
            break;
          }
        }
        if (!added) {
          items.push(this.clone_order(user_order));
        }
      }

    }

    return {items: this.compactOrderList(items), users: users};
  }

  this.getOrdersForAll = function(order_id) {
    if (this.data.orders == null) {
      return [];
    }
    var items = this.getOrderList();

    var uids = Object.keys(this.data.orders);
    for (var x=0;x<uids.length;x++) {
      var uid = uids[x];
      var user_orders = this.getOrdersForUser(uid, order_id);

      for(var i =0;i<user_orders.items.length;i++) {
        var user_order = user_orders.items[i];
        var added = false;

        for(var j=0;j<items.length;j++) {
          if (user_order.description == items[j].description) {
            items[j].quantity += user_order.quantity;
            added = true;
            break;
          }
        }
        if (!added) {
          items.push(this.clone_order(user_order));
        }
      }

    }

    return {items: this.compactOrderList(items)};
  }

  this.storeOrder = function(uid, order_id, order) {
    if (this.data.orders == null) {
      this.data.orders = {};
    }
    if (this.data.orders[uid] == null) {
      this.data.orders[uid] = {};
    }
    if (this.data.orders[uid][order_id]) {
      /* Copy all the keys */
      var keys = Object.keys(order);
      for (var i = 0 ; i < keys.length ; i++){
        this.data.orders[uid][order_id][keys[i]] = order[keys[i]];
      }
    } else {
      this.data.orders[uid][order_id] = order;
    }
    return this.save();
  }

  return this;
}

module.exports = Db;
