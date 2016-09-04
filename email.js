function Email() {
  var api_key = 'key-c8af7d35c98a3581d0496f4e07d7703c';
  var domain = 'revu.in';
  var mailgun = require('mailgun-js')({apiKey: api_key, domain: domain});

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
  return this;
}

module.exports = Email;

