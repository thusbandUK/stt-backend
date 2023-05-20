var express = require('express');

var router = express.Router();

router.get('/', function(req, res, next) {
  if (!req.user) { return res.render('home'); }
  console.log(req.user)
  next();
  res.render('index', { user: req.user });
});

module.exports = router;