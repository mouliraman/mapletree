'use strict';

const Path = require('path');
const Hapi = require('hapi');
const Inert = require('inert');
const Fs = require('fs');
const Good = require('good');
const Joi = require('joi');
const exec = require('child_process').exec;
const crypto = require('crypto');

const mongoose = require('mongoose');
mongoose.Promise = require('bluebird');

global.config = require('./config');
const User = require('./user');
const Order = require('./order');

const Email = require('./email');

// Create a server with a host and port
const server = new Hapi.Server({
  connections: {
    routes: {
      files: { relativeTo: Path.join(__dirname, 'public') },
      payload: {
        output: 'data',
        parse: true
      }
    }
  }
});

if (!process.env.MAILGUN_KEY) {
  throw('Please provide MAILGUN_KEY as env variable');
}
const email = new Email(process.env.MAILGUN_KEY);

mongoose.connect(global.config.db_url);
server.connection({ host: '0.0.0.0', port: global.config.server_port });

// get profile information about the user
server.route({
  method: 'GET',
  path:'/users/{uid}.json',
  handler: (req, reply) => {
    if (req.params.uid == 'all') {
      User.find().lean().exec().then(function (users) {
        reply({status: 'success', users: users});
      });
    } else {
      User.findById(parseInt(req.params.uid)).lean().exec().then(function(user) {
        if (user) {
          if (user.blocked) {
            server.log('error', 'user with the id is blocked: ' + req.params.uid);
            reply({status: 'failed', reason: 'user blocked'});
          } else {
            var session = {
              info: req.yar.flash('info'),
              error: req.yar.flash('error')
            }
            server.log('info', 'session error flash : ' + session.error);
            server.log('info', 'session info  flash : ' + session.info);
            if ((session.info.length == 0) && (session.error.length == 0)) {
              session.info = "You have been logged in."
            }

            reply({status: 'success', profile: user, session: session});
          }
        } else {
          server.log('error', 'user with the id not found: ' + req.params.uid);
          reply({status: 'failed', reason: 'not found'});
        }
      });
    }
  }
});

server.route({
  method: 'POST',
  path: '/forgot.json',
  handler: (req, reply) => {
    User.findByEmail(req.payload.email).then(function (user) {

      if (user) {
        if (user.blocked) {
          server.log('error', 'user is blocked. cannot reset the password');
          return(Promise.reject('user with email ' + req.payload.email + ' is blocked'));
        } else {
          // generate a reset token and store it in db
          return user.resetMe();
        }
      } else {
        server.log('error','email does not exist. rejecting the promise');
        return(Promise.reject('user with email ' + req.payload.email + ' does not exist'));
      }
    }).then(function (user) {

      server.log('info', 'sending email to ' + user.email);
      // send email to user with reset link
      email.send_reset_email(user);

      // send 200 OK response
      reply({status: 'success', message: 'We have sent an email to you with instructions on how to reset your password. Please check your email.'});
    }, function (err) {
      reply({statusCode: 404, error: 'Not Found', message: err}).code(404);
    });
  },
  config: {
    validate: {
      payload: Joi.object({
        email: Joi.string().email().required()
      }).unknown()
    }
  }

});

server.route({
  method: 'GET',
  path: '/users/forgot/{token}',
  handler: (req,reply) => {
    User.findByToken(req.params.token).then(function(user) {
      if (user) {
        if (user.blocked) {
          return reply({statusCode: 400, error: 'Bad Request', message: 'User is blocked. cannot reset password.'}).code(400);
        } else {
          return reply.view('reset.html',user);
        }
      } else {
        return reply({statusCode: 400, error: 'Bad Request', message: 'No user found with the given token'}).code(400);
      }
    });
  }
});

server.route({
  method: 'POST',
  path: '/users/reset/{token}',
  handler: (req, reply) => {

    User.findByToken(req.params.token).then(function(user) {

      if (user) {
        if (req.payload.password != req.payload.password_confirmation) {
          user.error_message = 'password and password confirmation did not match';
          reply.view('reset.html',user);
          return Promise.reject('password did not match');
        } else if (user.blocked) {
          user.error_message = 'user is blocked';
          reply.view('reset.html',user);
          return Promise.reject('user is blocked');
        } else {
          return user.changePassword(req.payload.password);
        }

      } else {
        reply({statusCode: 400, error: 'Bad Request', message: 'No user found with the given token'}).code(400);
        return Promise.reject('user with given token not found');
      }

    }).then(function(user) {

      return reply({status: 'success'}).redirect('/');
    }, function (err) {
      server.log('error','could not change the password ' + err);
    });

  },
  config: {
    validate: {
      payload: Joi.object({
        password: Joi.string().required(),
        password_confirmation: Joi.string().required()
      }).unknown()
    }
  }
});


// register and set profile information about the user
server.route({
  method: 'POST',
  path:'/users/{uid}.json',
  handler: (req, reply) => {

    User.findById(req.payload._id).then(function(user) {
      if (user) {
        delete req.payload._id;
        for (var key in req.payload) {
          user[key] = req.payload[key];
        }
        return user.save();
      } else {
        return User.create(req.payload);
      }
    }, function (err) {
      return reply({status: 'failed', reason: 'could not find user with give id'});
    }).then(function(user) {
      return reply({status: 'success', profile: user});
    });

  },
  config: {
    validate: {
      payload: Joi.object({
        _id: Joi.number().required(),
        name: Joi.string().required(),
        mobile: Joi.number().required(),
        email: Joi.string().required(),
        community: Joi.string().required(),
      }).unknown()
    }
  }
});

// delete the user
// TODO : Ensure that only admin is able to do this.
server.route({
  method: 'DELETE',
  path:'/users/{uid}.json',
  handler: (req, reply) => {

    User.findById(req.params.uid).then(function(user) {
      if (user) {
        user.blocked = true;
        return user.save();
        //return user.remove();
      } else {
        return Promise.reject('user with id ' + req.params.uid + ' not found');
      }
    }).then(function(user) {
      return reply({status: 'success'});
    }, function(err) {
      return reply({statusCode: 400, error: 'Bad Request', message: 'No user found with the given id'}).code(400);
    });
  }
});
 
// signup a user
server.route({
  method: 'POST',
  path:'/register.json',
  handler: (req, reply) => {

    User.addUser(req.payload).then(function(user) {

      return reply({status: 'success', profile: user});

    }, function (err) {

      server.log('error','register : error - ' + err);
      return reply({statusCode: 400, error: 'Bad Request', message: 'user with email ' + req.payload.email + ' is already registered'}).code(400);

    });
  },
  config: {
    validate: {
      payload: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        name: Joi.string().required()
      }).unknown()
    }
  }
});


// login the user
server.route({
  method: 'POST',
  path:'/login.json',
  handler: (req, reply) => {

    User.loginUser(req.payload.email, req.payload.password).then(function (user) {

      if (user) {
        if (user.blocked) {
          return reply({statusCode: 400, error: "Bad Request", message: "Your account has been blocked by the admin."}).code(400);
        } else {
          return reply({status: 'success', profile: user});
        }
      } else {

        return reply({statusCode: 400, error: "Bad Request", message: "user email and password don't match"}).code(400);
      }

    }, function (err) {

      server.log('error', 'login: error - ' + err);

    });

  },
  config: {
    validate: {
      payload: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
      }).unknown()
    }
  }
});

server.route({
  method: 'POST',
  path:'/data/orders/{order_id}.json',
  handler: (req, reply) => {

    var user_promise = User.findById(req.query.uid);
    var order_promise = user_promise.then(function(user) {
      if (user) {
        return Order.getOrdersForUser(user._id, req.params.order_id).then(function(order) {
          return Promise.resolve([user, order]);
        })
      } else {
        Promise.reject('user id ' + req.query.uid + ' does not exist');
      }
    });

    return order_promise.then(function(args) {
      var user = args[0];
      var order = args[1];
      var next_promise;
      if (order) {
        for (var key in req.payload) {
          order[key] = req.payload[key];
        }
        next_promise = order.save();
      } else {
        server.log('info','order not found. This is a new order');
        req.payload.user = user._id;
        req.payload.community = user.community;
        req.payload.date = req.params.order_id;
        next_promise = Order.create(req.payload);
      }

      return next_promise.then(function(order) {
        if (order) {
          server.log('info','order created/saved.');
          return Promise.resolve([user,order]);
        } else {
          server.log('error','order creation/save failed');
          return Promise.reject('order creation failed');
        }
      });

    }, function (err) {
      server.log('error', 'first ' + err);
      reply({statusCode: 400, error: 'Bad Request', message: err}).code(400);
    }).then(function(args) {
      var user = args[0];
      var order = args[1];
      order.discount_price = order.total_price - order.discount;
      if (!req.query.admin) {
        email.send_invoice(user, order, req.params.order_id);
      }
      if (order.state == 'delivered') {
        email.send_final_invoice(user, order, req.params.order_id)
      }
      reply({status: 'success'});
    }, function(err) {
      server.log('error','second ' + err);
      reply({statusCode: 400, error: 'Bad Request', message: err}).code(400);      
    });

  },
  config: {
    validate: {
      payload: Joi.object({
        items: Joi.array()
      }).unknown(),
      query: Joi.object({
        uid: Joi.string().required()
      }).unknown(),
      params: {
        order_id: Joi.string().required()
      }
    }
  }
});

server.route({
  method: 'GET',
  path: '/data/orders/used_inventory/{start_date}/{end_date}.{format}',
  handler: (req, reply) => {
    return Order.getInventoryUsage(req.params.start_date, req.params.end_date).then(function (resp) {
      resp.start_date = req.params.start_date;
      resp.end_date = req.params.end_date;
      if (req.params.format == 'json') {
        return reply(resp);
      } else {
        reply.view('inventory.csv',resp);
      }
    });
  }
});

server.route({
  method: 'GET', 
  path:'/data/orders/{uid}/index.json', 
  handler: (req, reply) => {
    var ret;
    var p = Order.find({user: parseInt(req.params.uid)}).select('date invoice_id state discount total_price discount_price paid_amount').limit(10).sort('-_id').lean().exec();
    return p.then(function (orders) {
      for(var i=0;i<orders.length;i++){
        orders[i].discount_price = orders[i].total_price - orders[i].discount;
      }
      return reply({'order_history' : orders});
    }, function (err) {
      return reply({statusCode: 400, error: 'Not Found', message: err}).code(400);
    });
  }
});


server.route({
  method: 'GET', 
  path:'/data/orders/{order_id}.json', 
  handler: (req, reply) => {
    if (req.query.uid) {
      return Order.getOrdersForUser(parseInt(req.query.uid), req.params.order_id).then(function(order) {
        if (!order) {
          order = {items: [], total_price: 0, discount_price: 0};
        }
        order.uid = req.query.uid;
        order.order_id = req.params.order_id;
        return reply(order);
      });
    } else if (req.query.community) {
      return Order.getOrdersForCommunity(req.params.order_id, req.query.community).then(function (resp) {
        resp.community = req.query.community;
        resp.order_id = req.params.order_id;
        return reply(resp);
      });
    } else {
      return Order.getOrdersForCommunity(req.params.order_id).then(function(resp) {
        resp.order_id = req.params.order_id;
        return reply(resp);
      });
    }
  }
});

server.route({
  method: 'POST',
  path:'/data/sync',
  handler: (req, reply) => {
    var v = exec('./export');
    v.on('exit', function (code, signal) {
      return reply({status: 'success'});
    });
  }
});

server.route({
  method: 'GET',
  path:'/data/invoice/{uid}/{order_id}',
  handler: (req, reply) => {
    Order.findOne({user: parseInt(req.params.uid), date: req.params.order_id}).populate('user').lean().exec().then(function(order) {
      if (order.state != 'ordered') {
        for(var i=0;i<order.items.length;i++) {
          order.items[i].quantity = order.items[i].packed_quantity;
        }
      }
      for(var i=0;i<order.items.length;i++) {
        order.items[i].price = order.items[i].quantity * order.items[i].rate;
        order.items[i].price = Math.round(order.items[i].price * 100)/100;
      }
      order.discount_price = order.total_price - order.discount;

      if (order.state == 'delivered') {
        order.merchant_id = global.config.pg_merchant_id;
        order.discount_price = parseFloat(order.total_price - order.discount).toFixed(2);

        var sign = crypto.createSign('RSA-SHA512');
        var signed_data = [global.config.pg_api_key, order.merchant_id, order.merchant_id, order._id, order.discount_price].join('#') + '#';
        sign.update(signed_data);
        order.sign = sign.sign(global.config.pg_private_key,'hex');
        order.callback_url = global.config.pg_callback_url;
        order.pg_url = global.config.pg_url;

      }
      if (order.state == 'paid') {
        order.balance_amount = order.discount_price - order.paid_amount;
      }

      reply.view('invoice.html',order);
 
    }, function(err) {
      server.log('error','invoice : ' + err);
    });

  }
});

/* TODO : Make the below request authenticated */
server.route({
  method: 'POST',
  path:'/data/payment/{status}',
  handler: (req, reply) => {
    server.log('info','callback from payment gateway : ' + req.params.status);
    server.log('info',req.payload);
    // TODO : send email to dev
    var p = Order.findById(req.payload.invoice).populate('user').exec();
    p.then(function(order) {
      if (order) {
        order.payment_status = req.params.status;
        if (req.params.status == 'success') {
          order.paid_amount = parseFloat(req.payload.amount);
          order.state = 'paid';
          order.save();  // TODO : Make sure you associate a promise callback here.
          req.yar.flash('info', 'Your payment is done. Thank you for making the payment.');

          // TODO : Send success mail to customer and shankar and accountant
        } else {
          server.log('error', 'The payment could not be completed.');
          req.yar.flash('error', 'The payment could not be completed.');
          // TODO : Send failure mail to customer.
        }

      } else {
        req.yar.flash('error', 'This is rather embarrassing. We could not associate your payment with an order.');
        server.log('error','no order found with invoice-id ' + req.payload.invoice);
      }
      return reply().redirect('/');
    });
  }
});

server.route({
  method: 'POST',
  path: '/data/daily/email',
  handler: (req, reply) => {
    // email.daily_email(); // TODO : Fixme
    return reply({statusCode: 200, status:  'success'});
  }
});

// Serve static files
server.register(Inert, () => {});

server.route({
  method: 'GET',
  path: '/{param*}',
  handler: {
    directory: {
                 path: '.',
                 redirectToSlash: true,
                 index: true
               }
  }
});

// Register session manager
server.register([
    {
      register: require('yar'),
      options: {
        cookieOptions: {
          password: 'random-password-string-to-encrypt-the-insecure-sessions',
          isSecure: (process.env.MODE == 'production') ? true : false
        }
      }
    }
  ], (err) => {server.log('error','yar initialization failed ' + err)});

const Handlebars = require('handlebars');
Handlebars.registerHelper("inc", (value, options) => {
  return parseInt(value) + 1;
});
Handlebars.registerHelper('ifEqual', function(v1, v2, options) {
  if(v1 == v2) {
    return options.fn(this);
  }
  return options.inverse(this);
});

server.register(require('vision'), (err) => {
  server.views({
    engines: {
      html: {
        module: Handlebars,
        compileMode: 'sync'
      },
      csv: {
        module: Handlebars,
        compileMode: 'sync',
        contentType: 'application/vnd.ms-excel'
      }
    },
    relativeTo: __dirname,
    path: 'templates'
  });
});

if (process.env.SENTRY_DSN) {
  server.register({
    register: require('hapi-raven'),
    options: {
      dsn: process.env.SENTRY_DSN
    }
  });
} else {
  server.log('error','SENTRY_DSN not specified so not installing the sentry client');
}

server.register({
  register: Good,
  options: {
    reporters: {
      console: [{
        module: 'good-squeeze',
        name: 'Squeeze',
        args: [{ log: '*', response: '*' }]
      }, {
        module: 'good-console'
      }, 'stdout'],
      file: [{
        module: 'good-squeeze',
        name: 'Squeeze',
        args: [{ log: '*', response: '*' }]
      },{
        module: 'good-squeeze',
        name: 'SafeJson'
      },{
        module: 'good-file',
        args: ['./log/hapi.log']
      }]
    }
  }
}, (err) => {
  if (err) {
    throw err; // something bad happened loading the plugin
  }

  server.start((err) => {
    if (err) {
      throw err; // something bad happened loading the plugin
    }
    server.log('info', 'Server running at: ' + server.info.uri);
  });
});

