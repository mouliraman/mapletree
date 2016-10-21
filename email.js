function Email(api_key) {
  var domain = 'revu.in';
  var mailgun = require('mailgun-js')({apiKey: api_key, domain: domain});

  this.daily_email = (db) => {

    var today = new Date();
    var today_weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()];
    console.log('searching for communities for ' + today_weekday);
    for (var i=0;i<db.data.users.length;i++) {
      var user = db.data.users[i];
      community = db.communities[user.community];
      if (community) {
        var message = {
          from: 'Mapletree Farms <no-reply@revu.in>',
          to: user.email,
        }

        if (community.start_day == today_weekday) {
          console.log('sending start window email to ' + user.name + ' for community ' + community.name);
          message.subject = '[Mapletree Farms] Place your weekly order';
          message.text = "Good Morning " + user.name + ",\n\n";
          message.text += "Your fridge must have run out of veggies. Guess what, your ordering window from Mapletree starts today.\n";
          message.text += "So what are you waiting for? Head over to http://mpt.revu.in and place your order in a jiffy\n\n";
          message.text += "Cheers\n";
          message.text += "-Shankar\n";
        } else if (community.end_day == today_weekday) {
          console.log('sending end window email to ' + user.name + ' for community ' + community.name);
          message.subject = '[Mapletree Farms] Your order window closes today';
          message.text = "Good Morning " + user.name + ",\n\n";
          message.text += "I know you would have placed your order for the veggies this week, so go ahead and delete this email\n";
          message.text += "In the remote possibility that you forgot, today is the last chance\n";
          message.text += "Head over to http://mpt.revu.in and place your order before your window closes\n\n";
          message.text += "Cheers\n";
          message.text += "-Shankar\n";
        }

        if (message.text) {
          console.log('sending email to ' + message.to + ' sub: ' + message.subject);
          mailgun.messages().send(message, function (error, body) {
            if (error) {
              console.log('email:error: failed to send email ' + error);
            }
          });
        }
      } else {
        console.log('no community for ' + user.name + ' community ' + user.community);
      }
    }

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
    message.text += "-Shankar\n";
    message.text += "http://mpt.revu.in\n";

    mailgun.messages().send(message, function (error, body) {
      if (error) {
        console.log('email:error: failed to send email ' + error);
      }
    });

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

    mailgun.messages().send(message, function (error, body) {
      if (error) {
        console.log('email:error: failed to send email ' + error);
      }
    });
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
    message.text += "-Shankar\n";

    mailgun.messages().send(message, function (error, body) {
      if (error) {
        console.log('email:error: failed to send email ' + error);
      }
    });
  }

  this.send_invoice = (user, order, order_id) => {

    var message = {
      from: 'Mapletree Farms <no-reply@revu.in>',
      to: user.email,
      subject: '[Mapletree Farms] Order Confirmation',
    }

    var url;
    if (process.env.PORT == 3000) {
      url = "http://localhost:3000/data/invoice/" + user.id + "/" + order_id;
    } else {
      url = "http://mpt.revu.in/data/invoice/" + user.id + "/" + order_id;
    }
    message.html = "<p>Dear " + user.name + ",</p>";
    message.html += "<p>Thank you for placing your organic and fresh veggies order at http://mpt.revu.in. We have received an order worth Rs. " + order.discount_price + "/-.</p>";
    message.html += "<p>You can view your current order <a href=\"" + url + "\">here</a>.\nYou can modify and submit the order any number of times before the end of your window. The last modified order will be taken for delivery.</p>";
    if ((order.customer_instructions) && (order.customer_instructions.length > 0)){
      message.html += "<p>Following is the instructions you have provided along with the order.<p>\n";
      message.html += "<p>" + order.customer_instructions + "</p>\n";
    }
    message.html += "<p>Thanks</p>";
    message.html += "<p>-Mapletree Farms</p>";

    mailgun.messages().send(message, function (error, body) {
      if (error) {
        console.log('email:error: failed to send email ' + error);
      }
    });
  }
  return this;
}

module.exports = Email;

