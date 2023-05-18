var express = require('express');

var router = express.Router();

//This is a model for the code that will fetch journals

function fetchJournalEntries(req, res, next) {
    const id = req.user.id;

    next();
    
    db.all('SELECT * FROM todos WHERE owner_id = ?', [
     req.user.id
    ], 
    function(err) {
      if (err) { return next(err); }
      
      var journals = 'this is where journal entries will render';
      res.locals.todos = journals;
      //res.locals.activeCount = todos.filter(function(todo) { return !todo.completed; }).length;
      //res.locals.completedCount = todos.length - res.locals.activeCount;
      next();
    });
  }


/* GET home page. */
router.get('/', function(req, res, next) {
  if (!req.user) { return res.render('home'); }
  console.log(req.user)
  next();
  //res.status(200).send(`Session initiated for user with username: ${req.user.username}`)
  res.render('index', { user: req.user });
}
/*, fetchJournalEntries, function(req, res, next) {
  //res.locals.filter = null;
  res.render('index', { user: req.user });
}*/

);

module.exports = router;