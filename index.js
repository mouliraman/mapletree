'use strict';

const Path = require('path');
const Hapi = require('hapi');
const Inert = require('inert');
const Fs = require('fs');
const Good = require('good');
const Joi = require('joi');
const exec = require('child_process').exec;

const Db = require('./db');

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

server.connection({ host: '0.0.0.0', port: process.env.PORT || 3000 });

const db = new Db();

// get profile information about the user
server.route({
  method: 'GET',
  path:'/users/{uid}.json',
  handler: (req, reply) => {
    if (req.params.uid == 'all') {
      reply({status: 'success', users: db.data.users});
    } else {
      var u = db.getUserById(req.params.uid);
      if (u) {
        reply({status: 'success', profile: u});
      } else {
        reply({status: 'failed', reason: 'not found'});
      }
    }
  }
});

// register and set profile information about the user
server.route({
  method: 'POST',
  path:'/users/{uid}.json',
  handler: (req, reply) => {
    db.updateUser(req.payload);
    reply({status: 'success', profile: req.payload});
  },
  config: {
    validate: {
      payload: Joi.object({
        id: Joi.number().required(),
        name: Joi.string().required(),
        mobile: Joi.number().required(),
        email: Joi.string().required(),
        community: Joi.string().required(),
      }).unknown()
    }
  }
});

// signup a user
server.route({
  method: 'POST',
  path:'/register.json',
  handler: (req, reply) => {
    var user = db.addUser(req.payload);
    if (user) {
      // TODO : Fire an email
      return reply({status: 'success', profile: user});
    } else {
      return reply({statusCode: 400, error: 'Bad Request', message: 'user with email ' + req.payload.email + ' is already registered'}).code(400);
    }
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

    var user = db.loginUser(req.payload.email, req.payload.password);
    if (!user) {
      return reply({statusCode: 400, error: "Bad Request", message: "user email and password don't match"}).code(400);
    }

    return reply({status: 'success', profile: user});
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
    db.storeOrder(req.query.uid, req.params.order_id, req.payload);
    reply({status: 'success'});
  },
  config: {
    validate: {
      payload: Joi.object({
        items: Joi.array()
      }).unknown(),
      query: {
        uid: Joi.string().required()
      },
      params: {
        order_id: Joi.string().required()
      }
    }
  }
});

server.route({
  method: 'GET', 
  path:'/data/orders/{order_id}.json', 
  handler: (req, reply) => {
    var ret;
    if (req.query.uid) {
      ret = db.getOrdersForUser(req.query.uid, req.params.order_id);
      ret.uid = req.query.uid;
    } else if (req.query.community) {
      ret = db.getOrdersForCommunity(req.query.community, req.params.order_id);
      ret.community = req.query.community;
    } else {
      ret = db.getOrdersForAll(req.params.order_id);
    }
    ret.order_id = req.params.order_id;
    return reply(ret);
  }
});

server.route({
  method: 'GET', 
  path:'/data/orders/{order_id}/user.json', 
  handler: (req, reply) => {
    if (req.query.uid) {
      reply(db.getOrdersForUser(req.query.uid, req.params.order_id));
    } else {
      reply({status: 'failed', reason: 'mandatory param uid not provided'});
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
    var order = db.getOrdersForUser(req.params.uid, req.params.order_id);
    var items = order.items;
    order.total_price = 0;
    for (var i = 0 ; i < items.length ; i++ ) {
      items[i].price = Math.round(items[i].quantity * items[i].rate * 100)/100;
      order.total_price += items[i].price;
    }
    reply.view('invoice',order);
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

server.register(require('vision'), (err) => {
  server.views({
    engines: {
      html: require('handlebars')
    },
    relativeTo: __dirname,
    path: 'templates'
  });
});

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
      }, 'stdout']/*,
      file: [{
        module: 'good-file',
        args: ['./log/hapi.log']
      }]*/
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

