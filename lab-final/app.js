var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var expressLayouts = require('express-ejs-layouts');

var indexRouter = require('./routes/index');
var protectedRouter = require('./routes/protected');

var sessionAuth = require('./middlewares/sessionAuth');
var superAdminMiddleware = require('./middlewares/super-admin');
var checkSessionAuth = require('./middlewares/checkSessionAuth');
var apiauth = require('./middlewares/apiauth');

var session = require('express-session');
var config = require('config');

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  session({
    secret: config.get('sessionSecret'),
    cookie: { maxAge: 360000000 },
    resave: false,
    saveUninitialized: false,
  })
);

app.use(express.static(path.join(__dirname, 'public')));

app.use(
  '/super-admin',
  superAdminMiddleware,
  require('./routes/super-admin/dashbosrd')
);
app.use(
  '/super-admin',
  superAdminMiddleware,
  require('./routes/super-admin/products')
);

app.use('/api/public/products', require('./routes/api/public/products'));

app.use('/api/categories', apiauth, require('./routes/api/catagories'));

app.use('/api/products', apiauth, require('./routes/api/products'));
app.use('/api/auth', require('./routes/api/auth'));

app.use('/', sessionAuth, indexRouter);

app.use('/my-account', sessionAuth, checkSessionAuth, protectedRouter);

app.use('/', sessionAuth, require('./routes/shop'));
app.use('/', sessionAuth, require('./routes/api/product-view'));

app.use('/admin', express.static(path.join(__dirname, 'admin', 'build')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'build', 'index.html'));
});
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'build', 'index.html'));
});

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
