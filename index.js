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
        prefix: ''
      },
      npm: {}
    }),
    prefix = config.logging.prefix,
    loader = Loader(config);

// Initialize the loader
var promise = 
  // Initialize the packet manager
  loader.init(config)
  // Then start all the packages found
  .then(function() {
    return loader.startAll();
  })
  // And finally start a REPL, handing the loader as a parameter
  .then(function() {
    repl.start({
      prompt: 'jsos>',
      input: process.stdin,
      output: process.stdout
    })
  })
  .catch(function(err) {
  	log.error(prefix, 'Initialization failed: %s', err.message);
  });
