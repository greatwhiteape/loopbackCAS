'use strict';

var loopback = require('loopback');
var boot = require('loopback-boot');
var app = module.exports = loopback();
var cookieParser = require('cookie-parser');
var session = require('express-session');
var passport = require('passport');

var path = require('path');
global.appRoot = path.resolve(__dirname);

var http = require('http');
var https = require('https');
var sslConfig = require('./ssl-config');

/*
* body-parser is a piece of express middleware that
*   reads a form's input and stores it as a javascript
*   object accessible through `req.body`
*
*/
var bodyParser = require('body-parser');
/**
 * Flash messages for passport
 *
 * Setting the failureFlash option to true instructs Passport to flash an
 * error message using the message given by the strategy's verify callback,
 * if any. This is often the best approach, because the verify callback
 * can make the most accurate determination of why authentication failed.
 */
var flash = require('express-flash');

// -- Add your pre-processing middleware here --

// Setup the view engine (jade)
var path = require('path');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// boot scripts mount components like REST API
boot(app, __dirname);

// to support JSON-encoded bodies
app.middleware('parse', bodyParser.json());
// to support URL-encoded bodies
app.middleware('parse', bodyParser.urlencoded({
  extended: true,
}));

// The access token is only available after boot
app.middleware('auth', loopback.token({
  model: app.models.accessToken,
}));

app.middleware('session:before', cookieParser(app.get('cookieSecret')));
app.middleware('session', session({
  secret: 'kitty',
  saveUninitialized: true,
  resave: true,
}));
app.use(passport.initialize());
app.use(passport.session());

// We need flash messages to see passport errors
app.use(flash());

var CasStrategy = require('passport-cas2').Strategy;

passport.use(new CasStrategy({
  casURL: 'https://cas.gmri.org/',
  pgtURL: 'https://cas.gmri.org/',
},
function(username, profile, done) {
  User.findOrCreate({id: profile.id}, function(err, user) {
   console.log('user: ', user);
    done(err, user);
  });
}));

var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;

app.get('/', function(req, res, next) {
  res.render('pages/index', {user:
    req.user,
    url: req.url,
  });
});

app.get('/auth/account', ensureLoggedIn('/login'), function(req, res, next) {
  res.render('pages/loginProfiles', {
    user: req.user,
    url: req.url,
  });
});

app.get('/auth/cas',
  passport.authenticate('cas'/*, {failureRedirect: '/login'}*/),
  function(req, res) {
    console.log(this);
    // Successful authentication, redirect home.
    res.redirect('/auth/account');
  });

  app.get('/login', function(req, res, next) {
    res.render('pages/login', {
      user: req.user,
      url: req.url,
    });
  });

  app.get('/auth/logout', function(req, res, next) {
    req.logout();
    res.redirect('/');
  });

  app.start = function(httpOnly) {
    if (httpOnly === undefined) {
      httpOnly = process.env.HTTP;
    }
    var server = null;
    if (!httpOnly) {
      var options = {
        key: sslConfig.privateKey,
        cert: sslConfig.certificate,
      };
      server = https.createServer(options, app);
    } else {
      server = http.createServer(app);
    }
    server.listen(app.get('port'), function() {
      var baseUrl = (httpOnly ? 'http://' : 'https://') + app.get('host') + ':' + app.get('port');
      app.emit('started', baseUrl);
      console.log('LoopBack server listening @ %s%s', baseUrl, '/');
      if (app.get('loopback-component-explorer')) {
        var explorerPath = app.get('loopback-component-explorer').mountPath;
        console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
      }
    });
    return server;
  };

/*
app.start = function() {
  // start the web server
  return app.listen(function() {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};*/

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function(err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});
