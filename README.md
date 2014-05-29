# JSOS-Init

A package for easily starting/stopping programs installed in your local npm registry.

Things that it covers
* Automatically starts the packages in your local NPM repository using npm API, issuing the command equivalent to 'npm start <your_module>'.
* Respawns your dead applications, in case you have 'respawn: true' flag in your package.json

For more information on the stack, please see
[JSOS home page](http://js-os.org/).

## Installation and Usage
    
    # Install JSOS-init
    npm install jsos-init

    # Start jsos-init
    npm start jsos-init