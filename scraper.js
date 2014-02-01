const NPM = 'http://registry.npmjs.org/';
var
	request = require('request'),
	moment = require('moment'),
	level = require('level'),
	path = require('path'),
	url = require('url'),
	thunkify = require('thunkify'),
	GithubApi = require('github'),
	deleteStream = require('level-delete-stream'),
	modules = require('./modules.json'),
	db = level('./web_modules.db', {valueEncoding: 'json'})
;

exports.start =  function() {
	var 
		github = new GithubApi({version: "3.0.0", timeout: 10000}),
		npmGet = thunkify(request.get),
		ghGet = thunkify(github.repos.get),
		dbKeyStream = db.createKeyStream()
	;
	
	// clear all datas
	console.log("Start Module Scrap");
	dbKeyStream.pipe(deleteStream(db, function(err) {
		if (err) { console.log('Error: %s', err); return; }

		// scrap for new data	
		Object.keys(modules).forEach(function(moduleName) {
			var 
				ghModuleName = modules[moduleName],
				ghUser = ghModuleName.split('/')[0],
				ghRepo = ghModuleName.split('/')[1],
				npmModuleUrl = NPM + moduleName + '/latest'
			;
			// get github module data
			ghGet({user: ghUser, repo: ghRepo}, function(err, ghData) {
				if (err) { console.log('Error: %s', err); return; }		
				console.log("GH %s: %j", ghModuleName, ghData);

				npmGet({url: npmModuleUrl, json: true}, function(err, res, npmData) {
					if (err) { console.log('Error: %s', err); return; }
					console.log("NPM %s: %j", npmModuleUrl, npmData);
				
					var moduleData = {
						name: npmModuleName,
						gh_url: ghData.html_url,
						version: npmData.version,
						site: ghData.homepage ? url.resolve('http://', ghData.homepage) : '',
						created_at: moment(ghData.created_at).fromNow(),
						author: npmData.author.name,
						forks: ghData.forks_count,
						watchers: ghData.watchers,
						issues: ghData.open_issues,
						description: ghData.description
					};

					db.put(ghData.watchers, moduleData, function(err) {
						if (err) { console.log('Error: %s', err); return; }
						console.log("\nModule Data: %j\n-------------\n", moduleData);
					});				
				});
			});
		});
	}));
};

exports.list = function(callback) {
	var data = [];
	var stream = db.createValueStream();
	stream.on('data', function(err, result) {
		console.log(result);
		data.push(result);
	});
	stream.on('end', function(err) {
		return callback(err, data);
	});
};