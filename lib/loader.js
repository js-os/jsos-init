var Promise = require('bluebird'),
  	npm = Promise.promisifyAll(require('npm')),
    fs = Promise.promisifyAll(require('fs')),
    mkdirp = require('mkdirp'),
    path = require('path'),
    spawn = require('child_process').spawn,
  	log = require('npmlog'),
    deepExtend = require('deep-extend'),
    util = require('util');

// The main workhorse, a function with an internal state
function PackageLoader(config) {
  var prefix = config.log.prefix,
      // Runtime registry for the started instances
      registry = {};

  // Initializes the package loader
  function init() {
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
      // Check if the module installation directory exists;
      // if not, crete it.
      var modulePath = path.join(npmConfig.prefix, 'node_modules'),
          message =
            util.format('JSOS module path \'%s\' not found, creating it.',
              modulePath),
          promise;

      // Return if the module path exists, otherwise create it.
      if (fs.existsSync(modulePath)) {
        return Promise.resolve(npmConfig);
      }

      return new Promise(function(resolve, reject) {
        mkdirp(modulePath, function(err) {
          if (err) {
            return reject(err);
          }

          return resolve(npmConfig);
        });
      });
    })
    .then(function(npmConfig) {
      log.info(prefix, 'Initializing npm');

      return npm.loadAsync(npmConfig);
    })

    return promise;
  }

  function list() {
    log.info(prefix, 'Reading npm packages at %s', npm.dir);

    var promise = fs.readdirAsync(npm.dir)
    .then(function(packages) {
      if (packages.length === 0) {
        log.info('No packages found.');
      }

      return Promise.resolve(packages);
    });

    return promise;
  }

  function start(packageName) {
    log.info(prefix, 'Starting %s.', packageName);

    return new Promise(function(resolve, reject) {
      // npm start() api does not give PID or process information back;
      // we need to start the process our way;
      var wd = path.resolve(npm.dir, packageName),
          json = require(path.join(wd, 'package.json')),
          command,
          args,
          child,
          childStreams;

      // No valid working directory, reject the promise
      if (!wd || !json) {
        return reject(new Error('Package ' + packageName + ' not found!'));
      }

      // Read the package, hunt for the start script
      if (typeof(json.scripts) !== 'object' ||
          typeof(json.scripts.start) !== 'string') {
        return reject(new Error('Package ' + packagename +
          ' does not have a valid start script'));
      }
      // First parse everything as args, then shift the first one as a command
      args = json.scripts.start.split(/\s+/);
      command = args.splice(0, 1)[0];

      // Execute the modules
      // TODO the modules should log to their own logfiles
      childStreams = [ 'ignore', process.stdout, process.stderr ];
      child = spawn(command, args, { stdio: childStreams, cwd: wd });

      // Push the process to registry
      registry[packageName] + child;

      return resolve();
    });
  }

  // Return a value object from which functions can be called
  return {
    init: init,
    list: list,
    start: start,
    /*halt: halt,
    stop: stop,
    restart: restart*/
  }
}

exports = module.exports = PackageLoader;
