var Monitor = require('ping-monitor');
var axios = require('axios');
var twilio = require('twilio');


const phones = [ process.env.PHONE ];
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

var cieloMonitor = new Monitor({
	website: process.env.WEBSITE,
	interval: parseInt(process.env.INTERVAL, 10)
});

var sendSMS = function(message) {
	client.messages.create({
		body: message,
		to: phones[0],
		from: '+12678100051'
	});
};

var redeploy = function(id, profile) {
	if (!deploying) {
		deploying = true;
		console.log('DEPLOYMENT STARTED');
		sendSMS('Redeployment Triggered');
		axios.post('https://app.cloud66.com/api/3/stacks/' + id + '/deployment_profiles/' + profile + '/deploy').then(function(res) {

		});
	}
};

cieloMonitor.on('up', function(res) {
	if (res.statusCode === 200) {
		if (status !== 'UP') {
			sendSMS('Cielo Production UP');
		}
		status = 'UP';
		deploying = false;
		console.log('UP!');
	}
	else {
		status = 'DOWN';
		console.log('DOWN ERROR! ' + res.statusCode);
		redeploy(stack.id, stack.profile);
	}
});

cieloMonitor.on('down', function(res) {
	if (status !== 'DOWN') {
		sendSMS('Cielo Production DOWN');
	}
	status = 'DOWN';
	console.log('DOWN! ' + res.statusMessage);
	redeploy(stack.id, stack.profile);
});

cieloMonitor.on('error', function(res) {
	console.log('ERROR! ' + res.statusMessage);
	cieloMonitor.stop();
});

cieloMonitor.on('stop', function(res) {
	console.log('monitoring stopped');
});
