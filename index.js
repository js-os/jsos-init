// Require a the few dependencies we will need: A promise wrapper, package
// manager, log implementation and REPL loop for console
var Promise = require('bluebird'),
	Launcher = require('./lib/launcher'),
  path = require('path'),
	log = require('npmlog'),
	repl = require('repl'),
  rc = require('rc'),
	util = require('./lib/util'),
	nodeUtil = require('util');

function loadConfig(fileName) {
	var defaults = {
		logging: {
			prefix: 'init'
		},
		npm: {
			spin: false
		}
	};

	return new Promise(function(resolve, reject) {
		// Search for a config from several locations & environment variables;
		// see https://github.com/dominictarr/rc
		// Then construct a loader with the given configuration
		var loadedConfig = rc(fileName, defaults),
				parsedConfig;

		// Resolve the env. variables nested within the config
		parsedConfig = util.mapNested(loadedConfig, util.envReplace);

		resolve(parsedConfig);
	});
}

function createLauncher(config) {
	return new Promise(function(resolve, reject) {
		resolve(new Launcher(config));
	});
}

function startPackages(launcher) {
  return function(packages) {
    var promises = packages.map(launcher.start.bind(launcher))
    return Promise.all(promises);
  }
}

function startREPL(context) {
  // Callback that is invoked when REPL dies
  return new Promise(function(resolve, reject) {
    var cli = repl.start({
      prompt: 'jsos> ',
      input: process.stdin,
      output: process.stdout
    })

    // Pass the loader to the context
    for (prop in context) {
      if (context.hasOwnProperty(prop)) {
        cli.context[prop] = context[prop];
      }
    }

    // Handle the exist function
    cli.on('exit', function() {
      return resolve();
    })
  });
}

// Initialize the loader
var promise = loadConfig('jsos-init')
	.then(createLauncher)
	.then(function(launcher) {
	  // Then start all the packages found, and finally start the REPL
		// Note: All the launcher specifics need to be executed in Launcher context.
	  return launcher.init()
			.then(launcher.list)
		  .then(startPackages(launcher))
		  .done(startREPL({ launcher: launcher }))
	})
	.catch(function(err) {
		var message = nodeUtil.format('Initialization failed: %s', err.message);
  	log.error(message);
  });
