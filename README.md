A simple app for monitoring AD2USB data and alerting on various alarm system faults.

##Usage

Copy config.js.sample to config.js. Modify config.js to suit your specific installation.

`npm app.js`

In my case, I have set up a [Rasberry Pi](http://www.raspberrypi.org/) with [redis](http://redis.io/), the [ser2sock](https://github.com/nutechsoftware/ser2sock) software from nutech, and some [foscam cameras](http://foscam.us/).

Note that you will need to use the patched version of [node-ad2usb](https://github.com/alexkwolfe/node-ad2usb). Patch can be found [here](https://github.com/alexkwolfe/node-ad2usb/pull/1).