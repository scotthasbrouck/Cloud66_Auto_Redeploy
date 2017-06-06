var Monitor = require('ping-monitor');
var request = require('request');
var twilio = require('twilio');
var B = require('bluebird');

const phones = [ process.env.PHONE1, process.env.PHONE2 ];
const cloud66APIToken = process.env.C66_TOKEN;
const TwilioSID = process.env.TWILIO_SID;
const TwilioToken = process.env.TWILIO_TOKEN;
var client;

if (TwilioSID && TwilioToken) { client = new twilio(TwilioSID, TwilioToken); }

var INTERVAL = parseInt(process.env.INTERVAL || 10) / 60;

console.log('Interval: ' + (INTERVAL * 60).toString() + ' seconds');

var sites = [{
	name: 'Cielo Production',
	url: 'https://wildebeest.cielo-production-744542.c66.me/uptime',
	id: '0843b037b04448cb48db8b9253f0881c',
	status: 'DOWN',
	deploying: false
}, {
	name: 'Cielo Production Failover 2',
	url: 'https://wildebeest.cielo-production-failover-2.c66.me/uptime',
	id: '150656c6c0a5f2c5ffbe21e8aee14097',
	status: 'DOWN',
	deploying: false
}, {
	name: 'Cielo Production Failover - REDIS TEST',
	url: 'https://starling.cielo-production-failover.c66.me/uptime',
	id: 'd503cd7fcf917a0f321b384c7724a4b8',
	status: 'DOWN',
	deploying: false
}];

var sendSMS = function(message) {
	for (var i = 0; i < phones.length; i++) {
		client.messages.create({
			body: message,
			to: phones[i],
			from: '+12678100051'
		});
	}
};

var getFormatedDate = function () {
    var currentDate = new Date();
    currentDate = currentDate.toISOString();
    currentDate = currentDate.replace(/T/, ' ');
    currentDate = currentDate.replace(/\..+/, '');
    return currentDate;
};

var printStatus = function(message) {
	console.log(message + "\nTime: " + getFormatedDate() + "\n");
};


var processError = function(site) {
	var deploy = redeploy(site);
	return function(res) {
		if (site.status !== 'DOWN') {
			sendSMS(site.name + ' DOWN');
			printStatus(site.name + ' DOWN! Error: ' + res.statusMessage);
		}
		site.status = 'DOWN';
		deploy();
	}
};

var redeploy = function(site) {
	return function() {
		if (!site.deploying) {
			site.deploying = true;
			printStatus(site.name + ' RESTART TRIGGERED');
			sendSMS(site.name + ' RESTART TRIGGERED');
			request({
				url: 'https://app.cloud66.com/api/3/stacks/' + site.id + '/deployments',
				method: 'POST',
				headers: {
					'Authorization': "Bearer " + cloud66APIToken
				}
			}, function(err, res, body) { console.log(res); });
		}
	};
};

B.all(sites.map(function(site) {
	var monitor = new Monitor({
		website: site.url,
		interval: INTERVAL
	});
	var deploy = redeploy(site);
	monitor.on('up', function(res) {
		if (res.statusCode === 200) {
			if (site.status !== 'UP') {
				sendSMS(site.name + ' UP');
				printStatus(site.name + ' UP!');
			}
			site.status = 'UP';
			site.deploying = false;
		}
		else {
			site.status = 'DOWN';
			printStatus(site.name + ' DOWN: ERROR! ' + res.statusCode);
			deploy();
		}
	});

	monitor.on('down', processError(site));

	monitor.on('error', processError(site));

	monitor.on('stop', function(res) {
		printStatus(site.name + ' Monitoring stopped');
	});
})).then(function() {
	console.log('Monitoring Started on ' + sites.length.toString() + ' stacks');
});

