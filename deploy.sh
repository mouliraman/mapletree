#!/bin/sh

npm install
minify --output public/js/app.min.js public/js/admin.js  public/js/user.js
pm2 start index.js -n mpt --env production
