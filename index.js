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
                           files: {
                                    relativeTo: Path.join(__dirname, 'public')
                                  }
                         }
               }
});

server.connection({ host: '0.0.0.0', port: process.env.PORT || 3000 });

const db = new Db();

// get profile information about the user
server.route({method: 'GET', path:'/data/users/{uid}.json', handler: function(req, reply) {
  if (req.params.uid == 'all') {
    reply({status: 'success', users: db.data.users});
  } else {
    var u = db.getUser(req.params.uid);
    if (u) {
      reply({status: 'success', profile: u});
    } else {
      reply({status: 'failed', reason: 'not found'});
    }
  }
}});

// register and set profile information about the user
server.route({method: 'POST', path:'/data/users/{uid}.json', handler: function(req, reply) {
  if (req.payload) {
    if (db.updateUser(req.payload)) {
      reply({status: 'success', profile: req.payload});
    } else {
      reply({status: 'failed', reason: 'profile does not contain all requested information'});
    }
  } else {
    reply({status: 'failed', reason: 'mandatory param uid and/or profile not provided'});
  }
}, config: {payload: {
  output: 'data',
  parse: true
}
}
});

server.route({method: 'POST', path:'/data/orders/{order_id}.json', handler: function(req, reply) {
  if (req.payload && req.query.uid) {
    db.storeOrder(req.query.uid, req.params.order_id, req.payload);
    reply({status: 'success'});
  } else {
    reply({status: 'failed', reason: 'mandatory param uid and/or orders not provided'});
  }
}, config: {payload: {
  output: 'data',
  parse: true
}
}
});


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

server.route({method: 'GET', path:'/data/orders/{order_id}/all.json', handler: function(req, reply) {
  return reply({order_id: req.params.order_id, orders: db.getOrdersForAll(req.params.order_id)});
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
