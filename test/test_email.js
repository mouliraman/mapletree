const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/mpt_dev')
const Order = require ('../order');
const User = require('../user');
var o ;

var config = require('../config');
global.config = config;

const Email = require('../email');
const email = new Email(process.env.MAILGUN_KEY);

Order.findById('584d26a914df5f9b4c1f4d75').populate('user').then(function(order) {
  if (order) {
    email.send_invoice(order.user,order);
    email.send_final_invoice(order.user,order);
    email.welcome(order.user);
    email.send_reset_email(order.user);
  } else {
    console.log('could not get order');
  }
});

