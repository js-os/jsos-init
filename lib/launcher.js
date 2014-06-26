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
function Launcher(config) {
  // Public variables
  this.config = config;
  this.registry = {};
}

Launcher.prototype.init = function() {
  var promise = new Promise(function(resolve, reject) {
    var message,
        newConfig;

    // Wrong args, fail immediately
    if (!this.config || typeof(this.config) !== 'object') {
      message = util.format('Invalid configuration %j given', this.config);
      return reject(new Error(message));
    }

    // Create a shallow clone of config, explicitly setting the 'depth'
    // param to 1, so that we won't iterate the through npm tree when
    // looking for parameters
    newConfig = deepExtend({ depth: 0 }, this.config.npm);

    return resolve(newConfig);
  }.bind(this))
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
    log.info('Initializing npm');

    return npm.loadAsync(npmConfig);
  });

  return promise;
}

Launcher.prototype.list = function() {
  log.info(util.format('Reading npm packages at %s', npm.dir));

  var promise = fs.readdirAsync(npm.dir)
  .then(function(packages) {
    if (packages.length === 0) {
      log.info('No packages found.');
    }

    return Promise.resolve(packages);
  });

  return promise;
}

Launcher.prototype.start = function(packageName) {
  log.info(util.format('Starting \'%s\'.', packageName));

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
    this.registry[packageName] = child;

    return resolve();
  }.bind(this));
}

exports = module.exports = Launcher;
