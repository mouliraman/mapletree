const Fs = require('fs');

var config = {};

if (process.NODE_ENV == 'production') {
  console.log('starting the application in production mode');
  config.base_url = 'https://mpt.revu.in/'
  config.db_url = 'mongodb://localhost/mpt';
  config.server_port = 3001;  
  config.pg_api_key = '020705UANE81HLMY52AXY945741653K';
  config.pg_merchant_id = 'A048';  
  config.pg_private_key = Fs.readFileSync('fp.private.key');
  config.pg_url = "https://secure.fonepaisa.com/pg/pay";
  config.pg_callback_url = "https://mpt.revu.in/data/payment/";
  config.fake_email = false;
} else {
  console.log('starting the application in staging mode');
  config.base_url = 'http://mpt.revu.in:3000/'
  config.db_url = 'mongodb://localhost/mpt_dev';
  config.server_port = 3000;  
  config.pg_api_key = '08Z1782051U62BY9OUGW4XM67GF2004';
  config.pg_merchant_id = 'FPTEST';
  config.pg_private_key = Fs.readFileSync('fp.test.key');
  config.pg_url = "https://test.fonepaisa.com/pg/pay";
  config.pg_callback_url = "http://mpt.revu.in:3000/data/payment/";
  config.fake_email = true;
}

module.exports = config;
