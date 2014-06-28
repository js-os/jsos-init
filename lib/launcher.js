var Promise = require('bluebird'),
  	npm = Promise.promisifyAll(require('npm')),
    fs = Promise.promisifyAll(require('fs')),
    mkdirp = require('mkdirp'),
    path = require('path'),
    spawn = require('child_process').spawn,
    deepExtend = require('deep-extend'),
    util = require('util'),
    events = require('events');

// The main workhorse, a function with an internal state
function Launcher(config, log) {
  // Public variables
  this.log = log;
  this.config = config;
  // The registry of child processes
  this.registry = {};
}
util.inherits(Launcher, events.EventEmitter);

// Event handlers
Launcher.prototype.handleChildExit = function(moduleName, code, signal) {
  var message = 'Module \'%s\' stopped with code %s';
  this.log.info(util.format(message, moduleName, code));

  // Remove the module from registry
  delete this.registry[moduleName];

  // Re-emit the event
  this.emit('exit', moduleName, code, signal);
}

Launcher.prototype.handleChildError = function(moduleName, err) {
  this.log.info(util.format('Error with module %s: %s', moduleName, err));

  // Re-emit the event
  this.emit('error', moduleName, err);
}

Launcher.prototype.init = function() {
  this.log.info('Launcher initializing');

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
    this.log.info('Initializing npm');

    return npm.loadAsync(npmConfig);
  }.bind(this));

  return promise;
}

Launcher.prototype.list = function() {
  this.log.info(util.format('Reading npm packages at %s', npm.dir));

  var promise = fs.readdirAsync(npm.dir)
  .then(function(packages) {
    if (packages.length === 0) {
      this.log.info('No packages found.');
    }

    return Promise.resolve(packages);
  });

  return promise;
}

Launcher.prototype.info = function(moduleName) {
  var wd = path.resolve(npm.dir, moduleName);

  return require(path.join(wd, 'package.json'));
}

Launcher.prototype.running = function() {
  var running = {};

  for (key in this.registry) {
    if (!this.registry.hasOwnProperty(key)) {
      continue;
    }
    running[key] = this.registry[key];
  }

  return running;
}

Launcher.prototype.start = function(moduleName) {
  this.log.info(util.format('Starting \'%s\'.', moduleName));

  return new Promise(function(resolve, reject) {
    // npm start() api does not give PID or process information back;
    // we need to start the process our way;
    var wd = path.resolve(npm.dir, moduleName),
        json = this.info(moduleName),
        command,
        args,
        child,
        childStreams;

    // No valid working directory, reject the promise
    if (!wd || !json) {
      return reject(new Error('Module ' + moduleName + ' not found!'));
    }

    // Read the package, hunt for the start script
    if (typeof(json.scripts) !== 'object' ||
        typeof(json.scripts.start) !== 'string') {
      return reject(new Error('Module ' + moduleName +
        ' does not have a valid start script'));
    }
    // First parse everything as args, then shift the first one as a command
    args = json.scripts.start.split(/\s+/);
    command = args.splice(0, 1)[0];

    // Execute the modules
    // TODO the modules should log to their own logfiles
    childStreams = [ 'ignore', process.stdout, process.stderr ];
    child = spawn(command, args, { stdio: childStreams, cwd: wd });

    // Push the process to registry & hook the listeners
    this.registry[moduleName] = child;
    child.on('error', this.handleChildError.bind(this, moduleName));
    child.on('exit', this.handleChildExit.bind(this, moduleName));

    // Notify about the started module
    this.emit('start', moduleName);

    return resolve();
  }.bind(this));
}

Launcher.prototype.stop = function(moduleName, force) {
  this.log.info(util.format('Stopping \'%s\'.', moduleName));

  return new Promise(function(resolve, reject) {
    // Fetch a handle from the registry
    var process = this.registry[moduleName],
        message,
        // The termination signal to use - 9 kills immediately, 15 gracefully
        // See http://man7.org/linux/man-pages/man7/signal.7.html
        signal = (force) ? 'SIGKILL' : 'SIGTERM';

    // Raise an error in case of no process found
    if (!process) {
      message = util.format('Cannot stop module \'%s\', it is not running.', process);
      reject(new Error(message));
    }

    // Listen to the termination and error signals
    process.once('exit', function() {
      resolve(process);
    })
    process.once('error', function(err) {
      reject(err);
    })

    // Send a termination signal to the process to trigger the events
    process.kill(signal);
  }.bind(this));
}

exports = module.exports = Launcher;
