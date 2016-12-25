#!/bin/sh

npm install
minify --output public/js/app.min.js public/js/admin.js  public/js/user.js
MODE=production pm2 start index.js -n mpt
