// import config
var config = require('./config.js');

// import needed packages
var email = require("emailjs");
var cam = require('foscam')
var Alarm = require('ad2usb');
var moment = require('moment');
var redis = require("redis");
var path = require('path');
var fs = require('fs');

var client = redis.createClient(config.redis.port, config.redis.host);

var sendSms = function(subject) {
  var multi = client.multi();
  multi.get('text_per_day');
  multi.get('text_per_hour');
  
  multi.exec(function (err, replies) {
    var sendIt = false;

    if (!replies[1] || replies[1] < 1) {
      client.incr('text_per_hour');
      client.expire('text_per_hour', 60 * 60);
      if (!replies[0] || replies[0] < 10) {
        client.incr('text_per_day');
        client.expire('text_per_day', 60 * 60 * 24);
        sendIt = true;
      }
      
      console.log('text message rates', replies);
    }
 
    if (sendIt && config.twilio.to) {
      var twilio = require('twilio')(config.twilio.accountSid, config.twilio.authToken);
      
      config.twilio.to.forEach(function(toNumber) {
        twilio.sms.messages.create({
            body: subject,
            to: toNumber,
            from: config.twilio.from
        }, function(err, message) {
            console.log('sent', message.sid);
        });
      });
    }
  });

}

var sendEmail = function(subject, body, attachmentPath) {
  var multi = client.multi();
  multi.get('rate_per_hour');
  multi.get("rate_per_5second");

  multi.exec(function (err, replies) {
    var sendIt = false;
    
    if (!replies[1] || replies[1] < 1) {
      client.incr('rate_per_5second');
      client.expire('rate_per_5second', 5);
      if (!replies[0] || replies[0] < 10) {
        client.incr('rate_per_hour');
        client.expire('rate_per_hour', 60 * 60);
        sendIt = true;
      }
      console.log("email rates", replies);
    }
    
    if (sendIt) {
      var server  = email.server.connect(config.email.server);
      var eml = {
        text:    body,
        from:    config.email.from, 
        to:      config.email.to,
        subject: subject
      };
  
      if (attachmentPath && fs.existsSync(attachmentPath)) {
        eml.attachment = [
          {path: attachmentPath, name: path.basename(attachmentPath)}
         ];
      }
      
      console.log("sending email...", eml);
      
      server.send(eml, function(err, message) {
        console.log(err || message);
        if (attachmentPath) {
          fs.unlink(attachmentPath); // remove the picture after we send
        }
      });
    }
  });
}

var alarm = Alarm.connect(config.ad2usb.host, config.ad2usb.port, function() {
  // connected to interface
  console.log("connected to host: " + config.ad2usb.host);
  
  alarm.on('raw', function(sec1, sec2, sec3) {
    // compute time checks
    var m = moment();
    var startTime = moment();
    startTime.hour(config.time.start.hour);
    startTime.minute(config.time.start.minute);
    
    var endTime = moment();
    endTime.hour(config.time.end.hour);
    endTime.minute(config.time.end.minute);

    if ((m > startTime || m < endTime) && sec3.indexOf('"FAULT') == 0) {
      console.log('fault detected');
      
      var zone = config.zones[sec2];
      var subject = " Alarm Tripped";
      var body = "alarmbrew: alarm tripped.";
      
      if (zone) {
        subject = zone.name + subject;
        body = "\n\n\talarm type: " + zone.type;
        if (config.cameras[sec2]) {
          cam.setup(config.cameras[sec2]);
          
          var path =
            './pictures/' +
              moment().format('YYYYMMDD_HHmmss') + '_' + sec2 +
              '.jpg'
          
          cam.snapshot(path, function() {
              sendEmail(subject, body, path);
              sendSms(subject);
          });
        } else {
          // no attachment but send the email
          sendEmail(subject, body);
          sendSms(subject);
        }
      } else {
        subject = sec2 + " Zone " + subject;
        sendEmail(subject, body);
        sendSms(subject);
      }
    } // end FAULT
  });
});


