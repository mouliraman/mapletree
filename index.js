'use strict';

const Path = require('path');
const Hapi = require('hapi');
const Inert = require('inert');
const Fs = require('fs');
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
server.route({method: 'GET', path:'/users/{uid}.json', handler: function(req, reply) {
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
}});

// register and set profile information about the user
server.route({method: 'POST', path:'/users/{uid}.json', handler: function(req, reply) {
  if (req.payload) {
    if (db.updateUser(req.payload)) {
      reply({status: 'success', profile: req.payload});
    } else {
      reply({status: 'failed', reason: 'profile does not contain all requested information'});
    }
  } else {
    reply({status: 'failed', reason: 'mandatory param uid and/or profile not provided'});
  }
}});

// signup a user
server.route({method: 'POST', path:'/register.json', handler: function(req, reply) {
  if (req.payload) {
    var user = db.addUser(req.payload);
    if (user) {
      // TODO : Fire an email
      return reply({status: 'success', profile: user});
    } else {
      return reply({status: 'failed', reason: 'user with email ' + req.payload.email + ' is already registered'});
    }
  } else {
    reply({status: 'failed', reason: 'mandatory param uid and/or profile not provided'});
  }
}});


// login the user
server.route({method: 'POST', path:'/login.json', handler: function(req, reply) {

  //setTimeout(function() {
  if (!req.payload) {
    reply({status: 'failed', reason: 'mandatory param uid and/or profile not provided'});
  }

  if (!req.payload.email) {
    return reply({status: 'failed', reason: 'no email address provided'});
  }
  if (!req.payload.password) {
    return reply({status: 'failed', reason: 'no password provided'});
  }

  var user = db.loginUser(req.payload.email, req.payload.password);
  if (!user) {
    return reply({status: 'failed', reason: "user email and password don't match"});
  }

  return reply({status: 'success', profile: user});

  //}, 5000);

}});


server.route({method: 'POST', path:'/data/orders/{order_id}.json', handler: function(req, reply) {
  if (req.payload && req.query.uid) {
    db.storeOrder(req.query.uid, req.params.order_id, req.payload);
    reply({status: 'success'});
  } else {
    reply({status: 'failed', reason: 'mandatory param uid and/or orders not provided'});
  }
}});


server.route({method: 'GET', path:'/data/orders/all.json', handler: function(req, reply) {
  return reply(db.getOrdersForAll());
}});

server.route({method: 'GET', path:'/data/orders/community.json', handler: function(req, reply) {
  if (req.query.community) {
    reply(db.getOrdersForCommunity(req.query.community));
  } else {
    reply({status: 'failed', reason: 'mandatory param community not provided'});
  }
}});

server.route({method: 'GET', path:'/data/orders/{order_id}.json', handler: function(req, reply) {
  var ret = {order_id: req.params.order_id};
  if (req.query.uid) {
    ret.uid = req.query.uid;
    ret.orders = db.getOrdersForUser(req.query.uid, req.params.order_id);
  } else if (req.query.community) {
    ret.community = req.query.community;
    ret.orders = db.getOrdersForCommunity(req.query.community);
  } else {
    ret.orders = db.getOrdersForAll(req.params.order_id);
  }
  return reply(ret);
}});

server.route({method: 'GET', path:'/data/orders/{order_id}/user.json', handler: function(req, reply) {
  if (req.query.uid) {
    reply(db.getOrdersForUser(req.query.uid, req.params.order_id));
  } else {
    reply({status: 'failed', reason: 'mandatory param uid not provided'});
  }
}});

// Add the route
server.route({
    method: 'POST',
    path:'/{param*}', 
    handler: function (request, reply) {

      var dirs = request.path.split('/');
      var base_path = Path.join(__dirname, 'public');
      for (var i=0;i<dirs.length-1;i++) {
        base_path = Path.join(base_path,dirs[i]);
        console.log('checking path ' + base_path);
        try {
          Fs.accessSync(base_path);
        } catch (e) {
          console.log('making path ' + base_path);
          Fs.mkdirSync(base_path);
        }
      }
      const writable = Fs.createWriteStream(Path.join(__dirname, 'public', request.path));
      console.log('request ' + request.path);
      console.log('param   ' + request.payload);
      request.payload.pipe(writable);
      return reply('hello world');
    },
    config: {payload: {
               output: 'stream',
               parse: false
             }
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

// Start the server
server.start((err) => {

    if (err) {
        throw err;
    }
    console.log('Server running at:', server.info.uri);
});
