const Handlebars = require('handlebars');
const Fs = require('fs');

var Order = require('./order');
var User = require('./user');

function Email(api_key) {
  var domain = 'revu.in';
  var mailgun = require('mailgun-js')({apiKey: api_key, domain: domain});

  this.send_email = (message) => {
    console.log('sending email to ' + message.to + ' sub: ' + message.subject);
    if (!global.config.fake_email) {
      mailgun.messages().send(message, function (error, body) {
        if (error) {
          console.log('email:error: failed to send email ' + error);
        }
      });
    } else {
      console.log('email body: ');
      if (message.text) {
        console.log(message.text);
      } else {
        console.log(message.html);
      }
    }

  }

  this.daily_email = (db) => {

    var today = new Date();
    var communities = Order.getCommunities();

    var today_weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()];
    console.log('searching for communities for ' + today_weekday);
    User.find().exec().then(function(users) {
      for (var i=0;i<users.length;i++) {
        var user = users[i];
        community = communities[user.community];
        if (community) {
          var message = {
            from: 'Mapletree Farms <no-reply@revu.in>',
            to: user.email,
          }
          var today_order_id = [today.getFullYear(), today.getMonth()+1, today.getDate()].join('-');

          if (community.start_day == today_weekday) {
            console.log('sending start window email to ' + user.name + ' for community ' + community.name);
            message.subject = '[Mapletree Farms] Place your weekly order';

            message.text = `Good Morning ${user.name},

This is a gentle reminder for you to order your veggies, fruits and groceries from Mapletree Farms.
Head over to http://mpt.revu.in and place your order in a jiffy

Cheers
-Shankar, your farmer @Mapletree
`;
          } else if (community.end_day == today_weekday) {             // today is end day of the community
            Order.find({user: user._id, date: today_order_id}).count().exec().then(function(c) {
              if (c == 0) { // user does not have order id for today
                console.log('sending end window email to ' + user.name + ' for community ' + community.name);
                message.subject = '[Mapletree Farms] Your order window closes today';

                message.text = `Good Morning ${user.name},

This is a gentle reminder for you to order your veggies, fruits and groceries from Mapletree Farms.
Your ordering window closes today at 12PM.
Head over to http://mpt.revu.in and place your order before your window closes

Cheers
-Shankar, your farmer @Mapletree
`
              }
            });
          }

          if (message.text) {
            this.send_email(message);
          }
        } else {
          console.log('no community for ' + user.name + ' community ' + user.community);
        }
      }
    });

  }

/* Deprecated method
  this.door_number = (user) => {
    var message = {
      from: 'Mapletree Farms <no-reply@revu.in>',
      to: user.email,
      subject: '[Mapletree Farms] Update your Door Number',
    }

    message.text = "Dear User " + user.name + ",\n\n";
    message.text += "We request you to update your Door number in the Preferences page. As soon as you login, you can select Preferences from Top-Left menu (\"My Account\").\n\n";
    message.text += "Then you can enter your Door number and then click on Save.\n\n";
    message.text += "This will record your door number and will help us deliver to the right address. Please ignore if Door number is not applicable to your community.\n\n";
    message.text += "Thanks\n";
    message.text += "-Shankar, your farmer @Mapletree\n";
    message.text += "http://mpt.revu.in\n";

    this.send_email(message);
  }
*/

  this.send_reset_email = (user) => {
    var message = {
      from: 'Mapletree Farms <no-reply@revu.in>',
      to: user.email,
      subject: '[Mapletree Farms] Reset Password',
    }

    var template = Handlebars.compile(Fs.readFileSync('email_templates/send_reset_email.html').toString());
    user.reset_url = global.config.base_url + "users/forgot/" + user.reset_token;
    message.html = template(user);

    this.send_email(message);
  }

  // TODO : This email is not being sent currently
  this.welcome = (user) => {

    var message = {
      from: 'Mapletree Farms <no-reply@revu.in>',
      to: user.email,
      subject: '[Mapletree Farms] Welcome',
    }
    var communities = Order.getCommunities();
    var template = Handlebars.compile(Fs.readFileSync('email_templates/welcome.html').toString());
    var data = {
      name: user.name, base_url: global.config.base_url,
      community: communities[user.community]
    };
    message.html = template(data);
    this.send_email(message);
  }

  this.send_final_invoice = (user, order) => {
   var message = {
      from: 'Mapletree Farms <no-reply@revu.in>',
      to: user.email,
      cc: "mapletreefarm16@gmail.com",
      subject: '[Mapletree Farms] Invoice - ' + user.name,
    }

    var url = global.config.base_url + "data/invoice/" + user.id + "/" + order.date;
    var discount_price = order.total_price - order.discount;

    var template = Handlebars.compile(Fs.readFileSync('email_templates/send_final_invoice.html').toString());
    var data = {
      name: user.name,
      mobile: user.mobile,
      discount_price: discount_price,
      url: url, base_url: global.config.base_url,
    };
    message.html = template(data);

    this.send_email(message);
  }

  this.send_invoice = (user, order) => {

    var message = {
      from: 'Mapletree Farms <no-reply@revu.in>',
      to: user.email,
      subject: '[Mapletree Farms] Order Confirmation',
    }

    var url = global.config.base_url + "data/invoice/" + user.id + "/" + order.date;
    var discount_price = order.total_price - order.discount;

    var template = Handlebars.compile(Fs.readFileSync('email_templates/send_invoice.html').toString());
    var data = {
      name: user.name,
      discount_price: discount_price,
      url: url, base_url: global.config.base_url,
      customer_instructions: order.customer_instructions
    };
    message.html = template(data);

    this.send_email(message);
  }

  this.auto_save_apology = (user) => {
   var message = {
      from: 'Mapletree Farms <no-reply@revu.in>',
      to: user.email,
      subject: '[Mapletree Farms] Please complete your Order',
    }

    message.html = "<p>Dear " + user.name + ",<\p>\n";
    message.html += "<p>Your order has been auto saved on Mapletree Website but it has not been submited. Can you please login to Mapletree website, visit the shopping card and submit the order. This will ensure we receive the order you intended and there is no mistake.</p>\n";
    message.html += "<p>-Thanks</p>";
    this.send_email(message);


  }
  this.payment_status = (status, order, params) => {
    // Send mail to dev guy
    var message = {
      from: 'Mapletree Farms <no-reply@revu.in>',
      to: 'mayanks@gmail.com',
      subject: '[Mapletree Farms] Payment - ' + status,
    }

    message.html = "<p>" + JSON.stringify(params) + "</p>";
    if (order){
      message.html += "<p>" + JSON.stringify(order.user) + "</p>";
    } else {
      message.html += "<p>No order found against the invoice id</p>";
    }

    this.send_email(message);

  }
  this.payment = (status, order, params) => {
    // Send mail to customer and Shankar
    var message = {
      from: 'Mapletree Farms <no-reply@revu.in>',
      to: order.user.email,
      subject: '[Mapletree Farms] Payment Failed',
    }

    var url = global.config.base_url + "data/invoice/" + order.user.id + "/" + order.date;
    var template = Handlebars.compile(Fs.readFileSync('email_templates/payment_' + status + '.html').toString());

    if (status == 'success') {
      message.cc = "mapletreefarm16@gmail.com, mayanks@gmail.com, shankarv.dsl@gmail.com";
      message.subject = '[Mapletree Farms] Payment Confirmation';
    }

    var data = {
      name: order.user.name,
      amount: params.amount,
      invoice_id: order._id,
      url: url, base_url: global.config.base_url,
    };
    message.html = template(data);

    this.send_email(message);
  }

  return this;
}

module.exports = Email;

