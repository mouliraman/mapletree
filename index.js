'use strict';

const Path = require('path');
const Hapi = require('hapi');
const Inert = require('inert');
const Fs = require('fs');

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

server.connection({ 
    host: 'localhost', 
    port: 80 
});

var consolidate = function() {
  var totalOrder = [];
  var communityOrder = {};

  // Iterate through each user directory
  fs.readDirSync(function () {
    for (var d in dirs) {
      if (fs.fileExists(d + '/order.json')) {
        user = fs.eval(d + '/profile.json');
        orders = fs.eval(d + '/order.json');
        if (!communityOrder[user.community]) {
          communityOrder[user.community] = [];
        }
        for (var o in orders) {
          for (var oo in totalOrder) {
            if (oo.name == o.name) {
              oo.quantity += o.quantity;
              added = true;
              break;
            }
          }
          if (!added) {
            totalOrder.concat(o);
          }

          for (var oo in communityOrder[user.community]) {
            if (oo.name == o.name) {
              oo.quantity += o.quantity;
              added = true;
              break;
            }
          }
          if (!added) {
            communityOrder[user.community].concat(o);
          }
        }
      }
    }
  });

  // sync totalOrder
  // sync communityOrder
}

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
