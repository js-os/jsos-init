// Require a the few dependencies we will need: A promise wrapper, package
// manager, log implementation and REPL loop for console
var Promise = require('bluebird'),
  	npm = Promise.promisifyAll(require('npm')),
    fs = Promise.promisifyAll(require('fs')),
  	log = require('npmlog'),
    deepExtend = require('deep-extend');

// The main workhorse, a function with an internal state
function PackageLoader(config) {
  var prefix = config.log.prefix,
      // Some promisified commands
      npmLs = nop,
      npmStart = nop,
      // Runtime registry for the started instances
      registry = {};

  // Dummy functions that will be replaced upon init
  function nop() {
    return Promise.reject(new Error('Loader: Run init() first'));
  }

  // Initializes the package loader
  function init(config) {
    var promise = new Promise(function(resolve, reject) {
      // Wrong args, fail immediately
      if (!config || typeof(config) !== 'object') {
        return promise.reject(new Error('Invalid configuration %s given', config));
      }

      // Create a shallow clone of config, explicitly setting the 'depth'
      // param to 1, so that we won't iterate the through npm tree when
      // looking for parameters
      var newConfig = deepExtend({ depth: 0 }, config.npm);

      return resolve(newConfig);
    })
    .then(function(npmConfig) {
      log.info(prefix, 'Initializing npm');
      return npm.loadAsync(npmConfig);
    })
    .then(function(npm) {
      // Bind the promises
      npmLs = Promise.promisify(npm.commands.ls),
      npmStart = Promise.promisify(npm.commands.start);

      return Promise.resolve(true);
    })

    return promise;
  }

  function list() {
    log.info(prefix, 'Reading npm packages at %s', npm.dir);

    var promise = fs.readdirAsync(npm.dir)
    .then(function(packages) {
      return Promise.resolve(packages);
    });

    return promise;
  }

  function startAll() {
    var promise = list()
    .then(function(packages) {
      var promises = packages.map(function(packageName) {
        return start(packageName);
      });


      // Stop the nasty npm spinner
      npm.spinner.stop();

      return Promise.all(promises);
    })

    return promise;
  }

  function start(packageName) {
    log.info(prefix, 'Starting %s.', packageName);

    // FIXME We should somehow get something from NPM start back, so that
    // we can properly ensure that we can stop the packages, too   
    return npmStart([ packageName ])
  }

  // Return a value object from which functions can be called
  return {
    init: init,
    list: list,
    start: start,
    startAll: startAll,
    /*halt: halt,
    stop: stop,
    restart: restart*/
  }
}

exports = module.exports = PackageLoader;