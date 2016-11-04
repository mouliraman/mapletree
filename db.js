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
  this.getUserByToken = (token) => { return this.getUser('reset_token', token);}

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

  this.changePassword = (user, new_password) => {
    var hash = crypto.createHash('sha256');
    hash.update(new_password);
    user.password = hash.digest('hex');
    return this.save();
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

  this.resetUser = (user) => {
    var token = Math.round(Math.random() * 9000000000000000);
    token += parseInt(user.id);
    user.reset_token = token.toString();
    return this.save();
  }

  this.getAllOrdersForUser = (user) => {
    var ret = [];
    if ((this.data.orders) && (this.data.orders[user.id])) {
      for (var key in this.data.orders[user.id]) {
        var order = this.data.orders[user.id][key];
        var item = {
          date: key,
          invoice_id: order.invoice_id,
          state: order.state,
          discount: order.discount,
          total_price: order.total_price,
          discount_price: order.total_price - order.discount
        }
        ret.push(item);
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

      order = this.data.orders[uid][order_id];
    }
    return order;
  }

  this.clone_order = (order) => {
    var new_order = {}
    for (key in order) {
      new_order[key] = order[key];
    }
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

  this.getOrderHistory = () => {
    var num_orders = {};
    for(var uid in this.data.orders) {
      for(var order_id in this.data.orders[uid]) {
        if (!num_orders[order_id]) {
          num_orders[order_id] = {count: 0, total: 0};
        }
        num_orders[order_id].count += 1;
        num_orders[order_id].total += this.data.orders[uid][order_id].total_price;
      }
    }
    return num_orders;
  }

  this.getInventoryUsage = (start_date, end_date) => {
    var items = {};
    var now = new Date();
    var num_orders = 0;

    var start_date_t = new Date(start_date);
    var end_date_t = new Date(end_date);

    for(var uid in this.data.orders) {
      for(var order_id in this.data.orders[uid]) {

        var order_date = new Date(order_id);
        if ((start_date_t > order_date) || (end_date_t < order_date)) {
          continue;
        }

        var order = this.data.orders[uid][order_id];

        for(var i = 0;i<order.items.length;i++) {

          var item = order.items[i];
          if (items[item.description]) {
            items[item.description].quantity += item.quantity;
          } else {
            items[item.description] = {
              description: item.description,
              quantity: item.quantity,
              rate: item.rate,
              category: item.category,
              unit: item.unit
            };

          }
          num_orders += 1;
        }
 
      }
    }
    // Round of all quantities
    var new_items = [];
    for (key in items) {
      items[key].quantity = Math.round(items[key].quantity * 100)/100;
      new_items.push(items[key]);
    }
    
    return {items: new_items, num_orders: num_orders};
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
      uu.total_price = user_orders.total_price - user_orders.discount;
      uu.state = user_orders.state;
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
      /* this is the first order. find the invoice id and save */
      order.invoice_id = this.getInvoiceId(order_id, uid);
      this.data.orders[uid][order_id] = order;
    }
    return this.save();
  }

  return this;
}

module.exports = Db;
