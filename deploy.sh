#!/bin/sh

npm install
minify --output public/js/app.min.js public/js/admin.js  public/js/user.js
PORT=3001 pm2 start index.js -n mpt
