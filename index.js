var Monitor = require('ping-monitor');
var axios = require('axios');
var twilio = require('twilio');


const phones = [ process.env.PHONE1, process.env.PHONE2 ];
const cloud66APIToken = process.env.C66_TOKEN;
const TwilioSID = process.env.TWILIO_SID;
const TwilioToken = process.env.TWILIO_TOKEN;

var client = new twilio(TwilioSID, TwilioToken);

// production
const stack = {
	id: process.env.STACK_ID,
	profile: process.env.STACK_PROFILE_ID
};

axios.defaults.headers.common['Authorization'] = "Bearer " + cloud66APIToken;

var status = 'DOWN';
var deploying = false;

var INTERVAL = process.env.INTERVAL || 0.5;

var cieloMonitor = new Monitor({
	website: process.env.WEBSITE,
	interval: parseInt(INTERVAL, 10);
});

var sendSMS = function(message) {
	for (var i = 0; i < phones.length; i++) {
		/*
		client.messages.create({
			body: message,
			to: phones[i],
			from: '+12678100051'
		});
		*/
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


var processError = function(res) {
	if (status !== 'DOWN') {
		sendSMS('Cielo Production DOWN');
		printStatus('DOWN! Error: ' + res.statusMessage);
	}
	status = 'DOWN';
	redeploy(stack.id, stack.profile);
}

var redeploy = function(id, profile) {
	if (!deploying) {
		deploying = true;
		printStatus('DEPLOYMENT STARTED');
		sendSMS('Elastic Address Toggled');
		axios.post('http://app.cloud66.com/api/3/elastic_addresses/' + process.env.ELASTIC_ADDRESS_ID).then(function(res) {
			console.log(res);
		});
		// axios.post('https://app.cloud66.com/api/3/stacks/' + id + '/deployment_profiles/' + profile + '/deploy').then(function(res) { });
	}
};

cieloMonitor.on('up', function(res) {
	if (res.statusCode === 200) {
		if (status !== 'UP') {
			sendSMS('Cielo Production UP');
			printStatus("UP!");
		}
		status = 'UP';
		deploying = false;
	}
	else {
		status = 'DOWN';
		printStatus('DOWN ERROR! ' + res.statusCode);
		redeploy(stack.id, stack.profile);
	}
});

cieloMonitor.on('down', processError);

cieloMonitor.on('error', processError);

cieloMonitor.on('stop', function(res) {
	printStatus('monitoring stopped');
});
