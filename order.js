var mongoose = require('mongoose');
var Fs = require('fs');
var User = require('./user');

mongoose.Promise = require('bluebird');
var Schema = mongoose.Schema;

var orderSchema = new Schema({
  date: String,
  invoice_id: String,
  state: String,
  total_price: Number,
  discount: Number,
  discont_price: Number,
  //user_id: String,
  user: {type: String, ref: 'User'},
  community: String,
  items: [Schema.Types.Mixed],
  customer_instructions: String,
  paid_amount: Number,
  payment_status: String
});

orderSchema.statics.getOrdersForUser = function(uid, order_id) {
  return Order.findOne({user: uid, date: order_id}).populate('user').exec();
}

orderSchema.statics.getCommunities = function() {

  var community_file = 'public/data/communities.json';
  var communities = {};
  var buf = Fs.readFileSync(community_file);
  var d = JSON.parse(buf.toString());
  for (var i = 0;i<d.length;i++) {
    communities[d[i].name] = d[i];
  }
  return communities;
}

orderSchema.statics.getOrderList = function() {
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

orderSchema.statics.compactOrderList = function(items) {
  var new_items = [];
  for (var i=0;i<items.length;i++) {
    if (items[i].quantity > 0) {
      new_items.push(items[i]);
    }
  }
  return new_items;
}

orderSchema.statics.getOrdersForAll = function(order_id) {
  return Order.find({date: order_id}).exec().then(function (orders) {
    var items = Order.getOrderList();
    for (var i=0;i<orders.length;i++) {
      for (var j=0;j<orders[i].items.length;j++) {
        var added = false;
        for (var k=0;k<items.length;k++){
          if (items[k].description == orders[i].items[j].description) {
            items[k].quantity += orders[i].items[j].quantity;
            added = true;
            break;
          }
        }
        if (!added) {
          items.push(orders[i].items[j]);
        }
      }
    }

    return Promise.resolve({items: Order.compactOrderList(items)});
  }, function(err) {
    return Promise.resolve({items: []});
  });
}

orderSchema.statics.getOrdersForCommunity = function(order_id, community) {
  var cond = {date: order_id};
  if (community) {
    cond.community = community;
  }

  return Order.find(cond).populate('user').exec().then(function (orders) {

    var items = Order.getOrderList();
    var users = [];
    console.log('found ' + orders.length + ' enteries');

    for(var k=0;k<orders.length;k++) {
      var order = orders[k];

      for(var i =0;i<order.items.length;i++) {
        var added = false;
        var user_order = order.items[i];

        for(var j=0;j<items.length;j++) {
          if (user_order.description == items[j].description) {
            items[j].quantity += user_order.quantity;
            added = true;
            break;
          }
        }
        if (!added) {
          items.push(user_order);
        }
      }

      var u = order.user;
      var uu = {name: u.name, email: u.email, mobile: u.mobile, uid: u._id};
      uu.total_price = order.total_price - order.discount;
      uu.state = order.state;
      users.push(uu);

    }

    return Promise.resolve({items: Order.compactOrderList(items), users: users});

  }, function (err) {
    console.log('experiencing error ' + err);
  });
}

orderSchema.statics.getInventoryUsage = function(start_date, end_date) {
  var start_date_t = new Date(start_date);
  var end_date_t = new Date(end_date);

  return Order.find({}).exec().then(function (orders) {
    var num_orders = 0;
    var items = {};

    for(var j=0;j<orders.length;j++) {
      var order = orders[j];

      var order_date = new Date(order.date);
      if ((start_date_t > order_date) || (end_date_t < order_date)) {
        continue;
      }

      num_orders += 1;

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
      }
    }

    // Round of all quantities
    var new_items = [];
    for (key in items) {
      items[key].quantity = Math.round(items[key].quantity * 100)/100;
      new_items.push(items[key]);
    }

    return Promise.resolve({items: new_items, num_orders: num_orders});
  });
}

orderSchema.statics.migrate = function() {
  var db = new require('./db')();

  // drop all the orders first.
  Order.count().exec().then(function(c) {
    console.log('there are ' + c + ' orders in the system currently. removing all of them');
    return Order.remove();
  }).then(function() {
    return Order.count().exec();
  }).then(function(c) {
    console.log('there are now ' + c + ' orders in the system');
    if (c) {
      throw('could not delete');
    }

    // iterate over all the users
    for (uid in db.data.orders) {
      // iterate over all the orders
      for (order_id in db.data.orders[uid]) {
        var o = db.data.orders[uid][order_id];
        //console.log('storing orders for user ' + u.name + ' and date ' + order_id);
        for (var z=0;z<o.items.length;z++){
          if (o.items[z]['s.no']) {
            o.items[z].s_no = o.items[z]['s.no'];
          } else if (o.items[z]['S.No']) {
            o.items[z].s_no = o.items[z]['S.No'];
          }
          delete o.items[z]['s.no'];
          delete o.items[z]['S.No'];
        }
        // store the order
        var old_user = db.getUserById(uid);
        o.community = old_user.community;
        o.date = order_id;
        o.user = parseInt(uid);
        Order.create(o).then(function(){},function(err){
          console.log('user : ' + uid + ' order-id : ' + order_id);
          console.log(err);
        });
      }
    }
  }, function(err) {console.log('error : ' + err)});
}

var Order = mongoose.model('Order',orderSchema);

module.exports = Order;
