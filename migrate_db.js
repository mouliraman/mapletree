const Db = require('./db');
const db = new Db();

var uids = Object.keys(db.data.orders);
for (var i = 0; i < uids.length; i++) {
  var uid = uids[i];
  var order_ids = Object.keys(db.data.orders[uid]);

  for (var j = 0; j < order_ids.length; j++) {
    var order_id = order_ids[j];
    var orders = db.data.orders[uid][order_id];
    db.data.orders[uid][order_id] = {
      state: 'ordered',
      invoice_id: '',
      customer_instructions: '',
      shipping_instructions: '',
      discount: 0,
      items: orders
    }
  }
}

db.save();

