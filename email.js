var Order = require('./order');
var User = require('./user');

function Email(api_key) {
  var domain = 'revu.in';
  var mailgun = require('mailgun-js')({apiKey: api_key, domain: domain});

  this.send_email = (message) => {
    console.log('sending email to ' + message.to + ' sub: ' + message.subject);
    if (process.env.MODE == 'production') {
      mailgun.messages().send(message, function (error, body) {
        if (error) {
          console.log('email:error: failed to send email ' + error);
        }
      });
    } else {
      console.log('email body: ');
      console.log(message.text);
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

  this.send_reset_email = (user) => {
    var message = {
      from: 'Mapletree Farms <no-reply@revu.in>',
      to: user.email,
      subject: '[Mapletree Farms] Reset Password',
    }

    message.text = "Hi " + user.name + ",\n\n";
    message.text += "Someone (hopefully you) has requested to reset password of your account. If that is you, please click on the following link and reset your password.\n\n";
    message.text += 'http://mpt.revu.in/users/forgot/' + user.reset_token + '\n\n';
    message.text += "If that person is not you, then ignore this email and all will be well.\n\n";
 
    message.text += "Thanks\n";
    message.text += "-Mapletree Farms\n";

    this.send_email(message);
  }

  this.welcome = (user) => {

    var message = {
      from: 'Mapletree Farms <no-reply@revu.in>',
      to: user.email,
      subject: '[Mapletree Farms] Welcome',
    }

    message.text = "Welcome " + user.name + ",\n\n";
    message.text += "Thank you for signing up at our online ordering app http://mpt.revu.in\n\n";
    message.text += "You are part of " + user.community.name + " community.";
    message.text += "Your shopping order window will open on " + user.community.start_day + " at " + user.community.start_time + " hours. You can place your order for the week til " + user.community.end_day + " " + user.community.end_time + " hours.\n\n";
    message.text += "If you have any questions or feedback on our service, do get in touch with us.\n\n";
    message.text += "Thanks\n";
    message.text += "-Shankar, your farmer @Mapletree\n";

    this.send_email(message);
  }

  this.send_final_invoice = (user, order, order_id) => {
   var message = {
      from: 'Mapletree Farms <no-reply@revu.in>',
      to: user.email,
      cc: "mapletreefarm16@gmail.com",
      subject: '[Mapletree Farms] Invoice - ' + user.name,
    }

    var url = global.config.base_url + "/data/invoice/" + user.id + "/" + order_id;
    message.html = `<p>Dear ${user.name},</p>
<p>Your order has been delivered and the final invoice is generated. The total bill for this invoice is Rs. ${order.discount_price}/-.</p>
<p>You can view your invoice <a href=\"${url}\">here</a>.</p>
<p>Please make the payment to the below mentioned account and send us an email confirmation with the transaction id.</p>

<p>Account Details :<br/>
Mapletree Farms Pvt. Ltd.<br/>
A/C No: 914020043283947<br/>
Axis Bank, Jayanagar Branch, Bangalore<br/>
IFSC Code: UTIB0000052<br/>
</p>

<p>Or, Please indicate invoice number and mail checks to<br/>
Gayathri Bisale,<br/>
Senior Accountant<br/>
Mapletree farm, <br/>
Outer Ring Road, <br/>
No: 58, 15th cross road, <br/>
J P Nagar, 2nd Phase<br/>
Bangalore, 560078<br/>
KA<br/>
India<br/>
</p>

<p>Thanks</p>
<p>-Mapletree Farms</p>`;

    this.send_email(message);

  }

  this.send_invoice = (user, order, order_id) => {

    var message = {
      from: 'Mapletree Farms <no-reply@revu.in>',
      to: user.email,
      subject: '[Mapletree Farms] Order Confirmation',
    }

    var url = global.config.base_url + "/data/invoice/" + user.id + "/" + order_id;

    message.html = "<p>Dear " + user.name + ",</p>";
    message.html += "<p>Thank you for placing your organic and fresh veggies order at http://mpt.revu.in. We have received an order worth Rs. " + order.discount_price + "/-.</p>";
    message.html += "<p>You can view your current order <a href=\"" + url + "\">here</a>.\nYou can modify and submit the order any number of times before the end of your window. The last modified order will be taken for delivery.</p>";
    if ((order.customer_instructions) && (order.customer_instructions.length > 0)){
      message.html += "<p>Following is the instructions you have provided along with the order.<p>\n";
      message.html += "<p>" + order.customer_instructions + "</p>\n";
    }
    message.html += "<p>Thanks</p>";
    message.html += "<p>-Mapletree Farms</p>";

    this.send_email(message);
  }
  return this;
}

module.exports = Email;

