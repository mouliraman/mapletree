#!/bin/sh

npm install
minify --output public/js/app.min.js public/js/admin.js  public/js/user.js
PORT=80 npm start 2>&1 | tee hapi.log
