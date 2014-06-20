// Require a the few dependencies we will need: A promise wrapper, package
// manager, log implementation and REPL loop for console
var Promise = require('bluebird'),
	Loader = require('./lib/loader'),
  path = require('path'),
	log = require('npmlog'),
	repl = require('repl'),
  rc = require('rc');

// Search for a config from several locations & environment variables; 
// see https://github.com/dominictarr/rc
// Then construct a loader with the given configuration
var config = rc('jsos-init', {
      logging: {
        prefix: 'init'
      },
      npm: {
        // Disable spinner, so that it does not screw up our CLI
        spin: false
      }
    }),
    prefix = config.logging.prefix,
    loader = Loader(config);

// Helper functions
function startPackages(loader) {
  return function(packages) {
    var promises = packages.map(loader.start)
    return Promise.all(promises);
  }
}

function startREPL(context) {
  return repl.start({
      prompt: 'jsos> ',
      input: process.stdin,
      output: process.stdout
    })

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
var promise = 
  // Initialize the packet manager
  loader.init(config)
  // Then start all the packages found
  .then(loader.list)
  // And finally start a REPL, handing the loader as a parameter
  .then(startPackages(loader))
  .then(startREPL({ config: config, loader: loader }))
  .catch(function(err) {
  	log.error(prefix, 'Initialization failed: %s', err.message);
  });
